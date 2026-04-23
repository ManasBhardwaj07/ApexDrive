const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { requireAuth, requireSubscription } = require('../middleware/auth');

// All score routes require auth + active subscription
router.use(requireAuth, requireSubscription);

/**
 * GET /api/scores
 * Returns current user's latest 5 scores (desc order)
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('scores')
      .select('*')
      .eq('user_id', req.userId)
      .order('score_date', { ascending: false })
      .limit(5);

    if (error) throw error;
    res.json({ scores: data });
  } catch (err) {
    console.error('GET /scores error:', err);
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
});

/**
 * POST /api/scores
 * Add a new score — the DB trigger handles rolling-5 deletion
 * Body: { score: number, score_date: "YYYY-MM-DD", notes?: string }
 */
router.post('/', async (req, res) => {
  try {
    const { score, score_date, notes } = req.body;

    // Validate
    if (!score || !score_date) {
      return res.status(400).json({ error: 'score and score_date are required' });
    }
    const scoreNum = parseInt(score, 10);
    if (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 45) {
      return res.status(400).json({ error: 'Score must be between 1 and 45 (Stableford)' });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(score_date)) {
      return res.status(400).json({ error: 'score_date must be YYYY-MM-DD format' });
    }

    // Don't allow future dates
    if (new Date(score_date) > new Date()) {
      return res.status(400).json({ error: 'Score date cannot be in the future' });
    }

    // Insert (UNIQUE constraint on user_id+score_date prevents duplicates)
    const { data, error } = await supabaseAdmin
      .from('scores')
      .insert({
        user_id: req.userId,
        score: scoreNum,
        score_date,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      // Unique violation = duplicate date
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'A score for this date already exists. Edit or delete it first.',
          code: 'DUPLICATE_DATE',
        });
      }
      throw error;
    }

    // Fetch updated scores list (trigger may have deleted oldest)
    const { data: updatedScores } = await supabaseAdmin
      .from('scores')
      .select('*')
      .eq('user_id', req.userId)
      .order('score_date', { ascending: false })
      .limit(5);

    res.status(201).json({
      message: 'Score added successfully',
      score: data,
      scores: updatedScores,
    });
  } catch (err) {
    console.error('POST /scores error:', err);
    res.status(500).json({ error: 'Failed to add score' });
  }
});

/**
 * PATCH /api/scores/:id
 * Edit an existing score
 * Body: { score?: number, notes?: string }
 * NOTE: score_date cannot be changed (would require delete + re-insert)
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { score, notes } = req.body;

    const updates = {};
    if (score !== undefined) {
      const scoreNum = parseInt(score, 10);
      if (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 45) {
        return res.status(400).json({ error: 'Score must be between 1 and 45' });
      }
      updates.score = scoreNum;
    }
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabaseAdmin
      .from('scores')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.userId)  // Ownership check
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Score not found' });

    res.json({ message: 'Score updated', score: data });
  } catch (err) {
    console.error('PATCH /scores/:id error:', err);
    res.status(500).json({ error: 'Failed to update score' });
  }
});

/**
 * DELETE /api/scores/:id
 * Delete a score by ID (user can only delete their own)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('scores')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Score not found' });

    res.json({ message: 'Score deleted successfully' });
  } catch (err) {
    console.error('DELETE /scores/:id error:', err);
    res.status(500).json({ error: 'Failed to delete score' });
  }
});

module.exports = router;
