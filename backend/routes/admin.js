const express = require('express');
const router  = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { notifyPayoutApproved } = require('../services/emailService');

// Apply admin-level protection to all routes in this file
router.use(requireAuth, requireAdmin);

// ── USER MANAGEMENT ─────────────────────────────────────────

router.get('/users', async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let query = supabaseAdmin
      .from('profiles')
      .select('*, charity:charities(name)', { count: 'exact' })
      .not('role', 'eq', 'admin')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ users: data, total: count, page, limit });
  } catch (err) {
    console.error('[GET /admin/users]', err.message);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [profileRes, scoresRes, entriesRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('*, charity:charities(*)').eq('id', id).single(),
      supabaseAdmin.from('scores').select('*').eq('user_id', id).order('score_date', { ascending: false }),
      supabaseAdmin.from('draw_entries').select('*, draw:draws(*), payout:payouts(*)').eq('user_id', id),
    ]);

    if (profileRes.error) {
      if (profileRes.error.code === 'PGRST116') {
        return res.status(404).json({ error: 'User not found' });
      }
      throw profileRes.error;
    }

    res.json({
      profile: profileRes.data,
      scores:  scoresRes.data  || [],
      entries: entriesRes.data || [],
    });
  } catch (err) {
    console.error('[GET /admin/users/:id]', err.message);
    res.status(500).json({ error: 'Failed to fetch user details.' });
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['full_name', 'subscription_status', 'charity_id', 'charity_contribution_percent', 'role'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ user: data });
  } catch (err) {
    console.error('[PATCH /admin/users/:id]', err.message);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// ── PAYOUT MANAGEMENT ───────────────────────────────────────

router.get('/payouts', async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabaseAdmin
      .from('payouts')
      .select(`
        *,
        user:profiles!user_id(id, full_name, email),
        draw:draws(draw_month, draw_year, draw_numbers)
      `)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ payouts: data });
  } catch (err) {
    console.error('[GET /admin/payouts]', err.message);
    res.status(500).json({ error: 'Failed to fetch payouts.' });
  }
});

router.patch('/payouts/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, admin_notes } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be "approve" or "reject"' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { data, error } = await supabaseAdmin
      .from('payouts')
      .update({
        status:      newStatus,
        reviewed_by: req.userId,
        reviewed_at: new Date().toISOString(),
        admin_notes: admin_notes || null,
      })
      .eq('id', id)
      .select('*, user:profiles!user_id(email, full_name)')
      .single();

    if (error) throw error;

    if (action === 'approve' && data.user?.email) {
      notifyPayoutApproved({
        email:       data.user.email,
        fullName:    data.user.full_name,
        prizeAmount: data.gross_amount,
        userId:      data.user_id,
      }).catch(() => {});
    }

    res.json({ payout: data });
  } catch (err) {
    console.error('[PATCH /admin/payouts/:id/review]', err.message);
    res.status(500).json({ error: 'Failed to review payout.' });
  }
});

router.patch('/payouts/:id/mark-paid', async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_reference } = req.body;

    const { data, error } = await supabaseAdmin
      .from('payouts')
      .update({
        status:            'paid',
        paid_at:           new Date().toISOString(),
        payment_reference: payment_reference || null,
      })
      .eq('id', id)
      .eq('status', 'approved')
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(400).json({ error: 'Payout must be in "approved" status before marking as paid.' });
    }

    res.json({ payout: data });
  } catch (err) {
    console.error('[PATCH /admin/payouts/:id/mark-paid]', err.message);
    res.status(500).json({ error: 'Failed to mark payout as paid.' });
  }
});

// ── CHARITY MANAGEMENT ──────────────────────────────────────

router.post('/charities', async (req, res) => {
  try {
    const { name, slug, description, short_description, website, registered_number, is_featured } = req.body;

    if (!name || !slug || !description) {
      return res.status(400).json({ error: 'name, slug, and description are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('charities')
      .insert({ name, slug, description, short_description, website, registered_number, is_featured: !!is_featured })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A charity with this slug already exists.' });
      }
      throw error;
    }

    res.status(201).json({ charity: data });
  } catch (err) {
    console.error('[POST /admin/charities]', err.message);
    res.status(500).json({ error: 'Failed to create charity.' });
  }
});

router.patch('/charities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['name', 'description', 'short_description', 'website', 'registered_number', 'is_featured', 'is_active', 'upcoming_events'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const { data, error } = await supabaseAdmin
      .from('charities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ charity: data });
  } catch (err) {
    console.error('[PATCH /admin/charities/:id]', err.message);
    res.status(500).json({ error: 'Failed to update charity.' });
  }
});

router.delete('/charities/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('charities')
      .update({ is_active: false })
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ message: 'Charity deactivated' });
  } catch (err) {
    console.error('[DELETE /admin/charities/:id]', err.message);
    res.status(500).json({ error: 'Failed to deactivate charity.' });
  }
});

// ── ANALYTICS ───────────────────────────────────────────────

router.get('/analytics', async (req, res) => {
  try {
    const [
      totalUsersRes,
      activeSubsRes,
      drawsRes,
      charitiesRes,
      payoutStatsRes,
    ] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('role', 'eq', 'admin'),

      supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_status', 'active')
        .not('role', 'eq', 'admin'),

      supabaseAdmin
        .from('draws')
        .select('prize_pool_total, jackpot_pool')
        .in('status', ['published', 'completed']),

      // [FIX] Pull directly from the global source of truth in the charities table
      supabaseAdmin
        .from('charities')
        .select('total_received'),

      supabaseAdmin
        .from('payouts')
        .select('status, gross_amount'),
    ]);

    const draws      = drawsRes.data;
    const charities  = charitiesRes.data;
    const payoutStats = payoutStatsRes.data;

    const totalPrizePool = draws?.reduce((sum, d) => sum + parseFloat(d.prize_pool_total || 0), 0) || 0;
    
    // [FIX] Sum total_received to capture user AND guest donations accurately
    const totalCharity   = charities?.reduce((sum, c) => sum + parseFloat(c.total_received || 0), 0) || 0;
    
    const totalPaid      = payoutStats?.filter(p => p.status === 'paid').reduce((sum, p) => sum + parseFloat(p.gross_amount || 0), 0) || 0;
    const pendingPayouts = payoutStats?.filter(p => ['pending', 'proof_submitted'].includes(p.status)).length || 0;

    res.json({
      totalUsers:         totalUsersRes.count  ?? 0,
      activeSubscribers:  activeSubsRes.count  ?? 0,
      totalPrizePool,
      totalCharityRaised: totalCharity,
      totalPaidOut:       totalPaid,
      pendingPayouts,
    });
  } catch (err) {
    console.error('[GET /admin/analytics]', err.message);
    res.status(500).json({ error: 'Failed to fetch analytics.' });
  }
});

module.exports = router;