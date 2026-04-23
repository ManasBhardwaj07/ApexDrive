// PATCH: backend/routes/draws.js
// Fixed bugs:
//   [1] simulate — draw fetch stripped { error } → DB error made draw undefined → TypeError crash
//       FIX: Added { error: drawFetchError } check
//   [2] simulate — draws.update before matching had no { error } check → silent failure
//       FIX: Added error check + early return
//   [3] publish — same draw fetch issue as simulate
//       FIX: Added { error: drawFetchError } check
//   [4] publish — draws.update for draft simulation phase had no error check
//       FIX: Added error check
//   [5] publish — winners fetch after publish had no { error } check
//       FIX: Added error check
//   [6] /results — draw fetch had no { error } check → silent null
//       FIX: Added error check
//   [7] /public and /my-entries and / admin list — missing console.error logging
//       FIX: Added structured logging to all catch blocks

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const DrawEngine = require('../services/drawEngine');
const { notifyDrawPublished, notifyWinner } = require('../services/emailService');

/**
 * GET /api/draws/public
 * Public: published draw results (last 12)
 */
router.get('/public', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('draws')
      .select('id, draw_month, draw_year, draw_numbers, status, prize_pool_total, jackpot_pool, match4_pool, match3_pool, jackpot_rollover, published_at')
      .in('status', ['published', 'completed'])
      .order('draw_year',  { ascending: false })
      .order('draw_month', { ascending: false })
      .limit(12);

    if (error) throw error;
    res.json({ draws: data });
  } catch (err) {
    console.error('[GET /draws/public]', err.message); // [FIX 7]
    res.status(500).json({ error: 'Unable to fetch draw results right now.' });
  }
});

/**
 * GET /api/draws/my-entries
 * Auth: current user's draw entries + payouts
 */
router.get('/my-entries', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('draw_entries')
      .select(`
        *,
        draw:draws(draw_month, draw_year, draw_numbers, status, published_at),
        payout:payouts(*)
      `)
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ entries: data });
  } catch (err) {
    console.error('[GET /draws/my-entries]', err.message); // [FIX 7]
    res.status(500).json({ error: 'Unable to fetch your draw history right now.' });
  }
});

// ── Admin routes ─────────────────────────────────────────────
router.use(requireAuth, requireAdmin);

/**
 * GET /api/draws
 * Admin: all draws
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('draws')
      .select('*')
      .order('draw_year',  { ascending: false })
      .order('draw_month', { ascending: false });

    if (error) throw error;
    res.json({ draws: data });
  } catch (err) {
    console.error('[GET /draws admin]', err.message); // [FIX 7]
    res.status(500).json({ error: 'Failed to fetch draws.' });
  }
});

/**
 * POST /api/draws/create
 */
router.post('/create', async (req, res) => {
  try {
    const { draw_month, draw_year, draw_type = 'random', prize_pool_total, rollover_amount = 0 } = req.body;

    if (!draw_month || !draw_year || !prize_pool_total) {
      return res.status(400).json({ error: 'draw_month, draw_year, and prize_pool_total are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('draws')
      .insert({
        draw_month:       parseInt(draw_month),
        draw_year:        parseInt(draw_year),
        draw_numbers:     [],
        draw_type,
        prize_pool_total: parseFloat(prize_pool_total),
        rollover_amount:  parseFloat(rollover_amount),
        status:           'draft',
        created_by:       req.userId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A draw for this month/year already exists' });
      }
      throw error;
    }

    res.status(201).json({ draw: data });
  } catch (err) {
    console.error('[POST /draws/create]', err.message);
    res.status(500).json({ error: 'Failed to create draw.' });
  }
});

/**
 * POST /api/draws/:id/simulate
 */
router.post('/:id/simulate', async (req, res) => {
  try {
    const { id } = req.params;

    // [FIX 1] Added { error } destructuring — without this, a DB error made
    // draw undefined and draw.status threw a TypeError, crashing the route.
    const { data: draw, error: drawFetchError } = await supabaseAdmin
      .from('draws')
      .select('*')
      .eq('id', id)
      .single();

    if (drawFetchError) {
      if (drawFetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Draw not found' });
      }
      throw drawFetchError;
    }

    if (!draw) return res.status(404).json({ error: 'Draw not found' });

    if (draw.status === 'published' || draw.status === 'completed') {
      return res.status(400).json({ error: 'Cannot simulate a published draw' });
    }

    const drawNumbers = draw.draw_type === 'algorithmic'
      ? await DrawEngine.generateAlgorithmic(`${draw.draw_year}-${String(draw.draw_month).padStart(2, '0')}`)
      : DrawEngine.generateRandom();

    // [FIX 2] Added { error } check on the update before matching
    const { error: updateError } = await supabaseAdmin
      .from('draws')
      .update({ draw_numbers: drawNumbers, status: 'simulated' })
      .eq('id', id);

    if (updateError) {
      console.error('[simulate] Failed to update draw numbers:', updateError.message);
      throw updateError;
    }

    const result = await DrawEngine.executeDrawMatching(id);

    res.json({
      message: 'Draw simulated successfully (not published)',
      drawNumbers,
      ...result,
    });
  } catch (err) {
    console.error('[POST /draws/:id/simulate]', err.message);
    res.status(500).json({ error: 'Failed to simulate draw. Check server logs for details.' });
  }
});

/**
 * POST /api/draws/:id/publish
 */
router.post('/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;

    // [FIX 3] Added { error } destructuring on draw fetch
    const { data: draw, error: drawFetchError } = await supabaseAdmin
      .from('draws')
      .select('*')
      .eq('id', id)
      .single();

    if (drawFetchError) {
      if (drawFetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Draw not found' });
      }
      throw drawFetchError;
    }

    if (!draw) return res.status(404).json({ error: 'Draw not found' });

    if (!['simulated', 'draft'].includes(draw.status)) {
      return res.status(400).json({ error: 'Draw must be in draft or simulated state to publish' });
    }

    // If not yet simulated, generate numbers and run matching first
    if (draw.status === 'draft') {
      const drawNumbers = draw.draw_type === 'algorithmic'
        ? await DrawEngine.generateAlgorithmic(`${draw.draw_year}-${String(draw.draw_month).padStart(2, '0')}`)
        : DrawEngine.generateRandom();

      // [FIX 4] Check error on draft simulation update
      const { error: draftUpdateError } = await supabaseAdmin
        .from('draws')
        .update({ draw_numbers: drawNumbers })
        .eq('id', id);

      if (draftUpdateError) {
        console.error('[publish] Failed to set draw numbers on draft:', draftUpdateError.message);
        throw draftUpdateError;
      }

      await DrawEngine.executeDrawMatching(id);
    }

    // Publish
    const { data, error: publishError } = await supabaseAdmin
      .from('draws')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (publishError) throw publishError;

    // Fire-and-forget email notifications — .catch() is correct here (non-blocking)
    notifyDrawPublished({
      drawMonth:   data.draw_month,
      drawYear:    data.draw_year,
      drawNumbers: data.draw_numbers,
    }).catch(err => console.error('[publish] Draw notification emails failed:', err.message));

    // [FIX 5] Added { error } check on winners fetch
    const { data: winners, error: winnersError } = await supabaseAdmin
      .from('draw_entries')
      .select('user_id, match_count, prize_amount, user:profiles(email, full_name)')
      .eq('draw_id', id)
      .eq('is_winner', true);

    if (winnersError) {
      console.error('[publish] Failed to fetch winners for notifications:', winnersError.message);
      // Non-fatal — draw is published; emails just won't fire
    } else if (winners?.length) {
      for (const w of winners) {
        const matchType =
          w.match_count === 5 ? '5-Match Jackpot' :
          w.match_count === 4 ? '4-Match Prize' : '3-Match Prize';

        notifyWinner({
          email:       w.user?.email,
          fullName:    w.user?.full_name,
          matchType,
          prizeAmount: w.prize_amount,
          userId:      w.user_id,
        }).catch(() => {}); // Fire-and-forget — .catch() is correct here
      }
    }

    res.json({ message: 'Draw published successfully', draw: data });
  } catch (err) {
    console.error('[POST /draws/:id/publish]', err.message);
    res.status(500).json({ error: 'Failed to publish draw. Check server logs for details.' });
  }
});

/**
 * GET /api/draws/:id/results
 * Admin: full draw results with winner details
 */
router.get('/:id/results', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: entries, error: entriesError } = await supabaseAdmin
      .from('draw_entries')
      .select(`
        *,
        user:profiles(id, full_name, email),
        payout:payouts(*)
      `)
      .eq('draw_id', id)
      .order('match_count', { ascending: false });

    if (entriesError) throw entriesError;

    // [FIX 6] Added { error } check on draw fetch in results
    const { data: draw, error: drawError } = await supabaseAdmin
      .from('draws')
      .select('*')
      .eq('id', id)
      .single();

    if (drawError && drawError.code !== 'PGRST116') {
      console.error('[GET /draws/:id/results] draw fetch error:', drawError.message);
    }

    res.json({
      draw:    draw || null,
      entries: entries || [],
      winners: (entries || []).filter(e => e.is_winner),
    });
  } catch (err) {
    console.error('[GET /draws/:id/results]', err.message);
    res.status(500).json({ error: 'Failed to fetch draw results.' });
  }
});

module.exports = router;