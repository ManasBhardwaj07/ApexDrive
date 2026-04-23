// ── charities.js ────────────────────────────────────────────
const express = require('express');
const charitiesRouter = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /api/charities
 * Public: list all active charities
 */
charitiesRouter.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('charities')
      .select('*')
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('name');

    if (error) throw error;
    res.json({ charities: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch charities' });
  }
});

/**
 * GET /api/charities/:slug
 * Public: get charity by slug
 */
charitiesRouter.get('/:slug', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('charities')
      .select('*')
      .eq('slug', req.params.slug)
      .eq('is_active', true)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Charity not found' });
    res.json({ charity: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch charity' });
  }
});

// ── profiles.js ─────────────────────────────────────────────
const profilesRouter = express.Router();

/**
 * GET /api/profiles/me
 * Get current user's full profile
 */
profilesRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*, charity:charities(*)')
      .eq('id', req.userId)
      .single();

    if (error) throw error;
    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * PATCH /api/profiles/me
 * Update current user's profile
 * Body: { full_name, phone, country, handicap, charity_id, charity_contribution_percent }
 */
profilesRouter.patch('/me', requireAuth, async (req, res) => {
  try {
    const allowed = ['full_name', 'phone', 'country', 'handicap', 'charity_id', 'charity_contribution_percent', 'avatar_url'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.charity_contribution_percent !== undefined) {
      const pct = parseFloat(updates.charity_contribution_percent);
      if (pct < 10 || pct > 100) {
        return res.status(400).json({ error: 'Contribution percent must be between 10% and 100%' });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', req.userId)
      .select('*, charity:charities(*)')
      .single();

    if (error) throw error;
    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * POST /api/profiles/upload-proof/:payoutId
 * User submits winner proof (proof URL from Supabase Storage)
 * Body: { proof_url }
 */
profilesRouter.post('/upload-proof/:payoutId', requireAuth, async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { proof_url } = req.body;

    if (!proof_url) return res.status(400).json({ error: 'proof_url is required' });

    const { data, error } = await supabaseAdmin
      .from('payouts')
      .update({
        proof_url,
        proof_submitted_at: new Date().toISOString(),
        status: 'proof_submitted',
      })
      .eq('id', payoutId)
      .eq('user_id', req.userId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Payout not found or not eligible for proof submission' });

    res.json({ payout: data, message: 'Proof submitted successfully — awaiting admin review' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit proof' });
  }
});

module.exports = { charitiesRouter, profilesRouter };
