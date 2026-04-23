const { supabaseAdmin } = require('../config/supabase');

class DrawEngine {
  static generateRandom() {
    const nums = new Set();
    while (nums.size < 5) {
      nums.add(Math.floor(Math.random() * 45) + 1);
    }
    return Array.from(nums).sort((a, b) => a - b);
  }

  static async generateAlgorithmic(drawMonth) {
    const { data: scores, error } = await supabaseAdmin
      .from('scores')
      .select('score')
      .gte('score_date', `${drawMonth}-01`)
      .lt('score_date', this._nextMonth(drawMonth));

    if (error) {
      console.error('[DrawEngine] generateAlgorithmic DB error → falling back to random:', error.message);
      return this.generateRandom();
    }

    if (!scores || scores.length === 0) return this.generateRandom();

    const freq = {};
    scores.forEach(({ score }) => { freq[score] = (freq[score] || 0) + 1; });

    const pool = [];
    Object.entries(freq).forEach(([score, count]) => {
      for (let i = 0; i < count; i++) pool.push(parseInt(score, 10));
    });

    const selected = new Set();
    let attempts = 0;
    while (selected.size < 5 && attempts < 500) {
      selected.add(pool[Math.floor(Math.random() * pool.length)]);
      attempts++;
    }
    while (selected.size < 5) {
      selected.add(Math.floor(Math.random() * 45) + 1);
    }

    return Array.from(selected).sort((a, b) => a - b);
  }

  static _nextMonth(drawMonth) {
    const [y, m] = drawMonth.split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    return `${next}-01`;
  }

  static countMatches(userScores, drawNumbers) {
    const drawSet = new Set(drawNumbers.map(n => parseInt(n, 10)));
    return userScores.filter(s => drawSet.has(parseInt(s, 10))).length;
  }

  static calculatePools(totalPool, rolloverAmount = 0) {
    return {
      jackpot: parseFloat(((totalPool * 0.40) + rolloverAmount).toFixed(2)),
      match4:  parseFloat((totalPool * 0.35).toFixed(2)),
      match3:  parseFloat((totalPool * 0.25).toFixed(2)),
    };
  }

  static calculatePrizePerWinner(winners, pools) {
    const result = { '5-match': 0, '4-match': 0, '3-match': 0 };
    const match5 = winners.filter(w => w.match_count === 5);
    const match4 = winners.filter(w => w.match_count === 4);
    const match3 = winners.filter(w => w.match_count === 3);
    if (match5.length > 0) result['5-match'] = parseFloat((pools.jackpot / match5.length).toFixed(2));
    if (match4.length > 0) result['4-match'] = parseFloat((pools.match4  / match4.length).toFixed(2));
    if (match3.length > 0) result['3-match'] = parseFloat((pools.match3  / match3.length).toFixed(2));
    return result;
  }

  static async executeDrawMatching(drawId) {
    const { data: draw, error: drawError } = await supabaseAdmin
      .from('draws')
      .select('*')
      .eq('id', drawId)
      .single();

    if (drawError || !draw) {
      throw new Error(`[DrawEngine] Draw not found (id: ${drawId}): ${drawError?.message || 'unknown'}`);
    }

    if (!Array.isArray(draw.draw_numbers) || draw.draw_numbers.length === 0) {
      throw new Error(`[DrawEngine] CRITICAL: draw_numbers is empty for draw ${drawId}. Simulate first.`);
    }

    const drawNumbersInt = draw.draw_numbers.map(n => parseInt(n, 10));

    const { data: subscribers, error: subError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('subscription_status', 'active');

    if (subError) throw new Error(`[DrawEngine] Failed to fetch subscribers: ${subError.message}`);

    if (!subscribers || subscribers.length === 0) {
      return { draw, winners: [], totalEntries: 0 };
    }

    const subscriberIds = subscribers.map(s => s.id);

    const { data: allScores, error: scoresError } = await supabaseAdmin
      .from('scores')
      .select('user_id, score, score_date')
      .in('user_id', subscriberIds)
      .order('score_date', { ascending: false });

    if (scoresError) throw new Error(`[DrawEngine] Failed to fetch scores: ${scoresError.message}`);

    const scoresByUser = {};
    for (const row of (allScores || [])) {
      if (!scoresByUser[row.user_id]) scoresByUser[row.user_id] = [];
      if (scoresByUser[row.user_id].length < 5) {
        scoresByUser[row.user_id].push(parseInt(row.score, 10));
      }
    }

    const entries = [];
    for (const userId of subscriberIds) {
      const userScores = scoresByUser[userId] || [];
      if (userScores.length < 3) continue;

      const matchCount = this.countMatches(userScores, drawNumbersInt);
      entries.push({
        user_id:       userId,
        entry_numbers: userScores,
        match_count:   matchCount,
        is_winner:     matchCount >= 3,
      });
    }

    const pools = this.calculatePools(draw.prize_pool_total, draw.rollover_amount || 0);
    const winners = entries.filter(e => e.is_winner);
    const prizePerWinner = this.calculatePrizePerWinner(winners, pools);

    for (const entry of entries) {
      const matchType =
        entry.match_count === 5 ? '5-match' :
        entry.match_count === 4 ? '4-match' :
        entry.match_count === 3 ? '3-match' : null;

      const prizeAmount = matchType ? prizePerWinner[matchType] : 0;

      const { data: entryRow, error: entryUpsertError } = await supabaseAdmin
        .from('draw_entries')
        .upsert({
          draw_id:       drawId,
          user_id:       entry.user_id,
          entry_numbers: entry.entry_numbers,
          match_count:   entry.match_count,
          is_winner:     entry.is_winner,
          prize_amount:  prizeAmount,
        }, { onConflict: 'draw_id,user_id' })
        .select('id')
        .single();

      if (entryUpsertError) {
        console.error(`[DrawEngine] ✗ draw_entry upsert failed:`, entryUpsertError.message);
        continue;
      }

      if (entry.is_winner && matchType && entryRow) {
        const { error: payoutError } = await supabaseAdmin
          .from('payouts')
          .upsert({
            draw_entry_id: entryRow.id,
            user_id:       entry.user_id,
            draw_id:       drawId,
            match_type:    matchType,
            gross_amount:  prizeAmount,
            status:        'pending',
          }, { onConflict: 'draw_entry_id' });

        if (payoutError) console.error(`[DrawEngine] ✗ payout upsert failed:`, payoutError.message);
      }
    }

    const hasJackpotWinner = winners.some(w => w.match_count === 5);

    const { error: drawUpdateError } = await supabaseAdmin
      .from('draws')
      .update({
        jackpot_pool:     pools.jackpot,
        match4_pool:      pools.match4,
        match3_pool:      pools.match3,
        jackpot_rollover: !hasJackpotWinner,
      })
      .eq('id', drawId);

    if (drawUpdateError) console.error('[DrawEngine] ✗ Failed to update draw pools:', drawUpdateError.message);

    return {
      draw,
      totalEntries:   entries.length,
      winners,
      prizePerWinner,
      pools,
      jackpotRollover: !hasJackpotWinner,
    };
  }
}

module.exports = DrawEngine;