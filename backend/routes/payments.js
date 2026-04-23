const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabaseAdmin } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');

// --- PRODUCTION HELPER: Secure Charity Synchronization ---
async function syncCharityTotal(charityId, amountToAdd) {
  try {
    const { data: charity, error: fetchErr } = await supabaseAdmin
      .from('charities')
      .select('total_received')
      .eq('id', charityId)
      .single();

    if (fetchErr) throw fetchErr;

    const newTotal = parseFloat(charity.total_received || 0) + parseFloat(amountToAdd);

    if (isNaN(newTotal)) {
      throw new Error('Calculated newTotal is NaN');
    }

    const { error: updateErr } = await supabaseAdmin
      .from('charities')
      .update({ total_received: newTotal })
      .eq('id', charityId);

    if (updateErr) throw updateErr;
    return true;
  } catch (err) {
    console.error(`[CRITICAL] Failed to sync charity total for ${charityId}:`, err.message);
    return false;
  }
}

router.post('/create-checkout', requireAuth, async (req, res) => {
  try {
    const { plan, charityId, charityPercent = 10 } = req.body;

    if (!['monthly', 'yearly'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid subscription plan' });
    }
    if (!charityId) {
      return res.status(400).json({ error: 'charityId is required' });
    }

    const priceId = plan === 'monthly'
      ? process.env.STRIPE_MONTHLY_PRICE_ID
      : process.env.STRIPE_YEARLY_PRICE_ID;

    if (!priceId) return res.status(500).json({ error: 'Payment configuration error.' });

    let customerId = req.user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.full_name || '',
        metadata: { supabase_user_id: req.userId },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', req.userId);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?subscription=success`,
      cancel_url: `${process.env.FRONTEND_URL}/subscribe?cancelled=true`,
      metadata: {
        supabase_user_id: req.userId,
        plan,
        charity_id: charityId,
        charity_percent: String(charityPercent),
      },
      subscription_data: {
        metadata: {
          supabase_user_id: req.userId,
          plan,
          charity_id: charityId,
          charity_percent: String(charityPercent),
        },
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[payments] Checkout session error:', err.message);
    res.status(500).json({ error: 'Unable to start checkout.' });
  }
});

router.post('/create-donation', async (req, res) => { 
  try {
    const { charityId, amount, userId } = req.body; 
    
    if (!charityId || !amount || amount < 50) {
      return res.status(400).json({ error: 'Valid charityId and amount (min ₹50) required' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'inr',
          product_data: { name: 'Independent Charity Donation', description: 'Digital Heroes' },
          unit_amount: amount * 100, 
        },
        quantity: 1,
      }],
      success_url: `${process.env.FRONTEND_URL}/charities?donation=success`,
      cancel_url: `${process.env.FRONTEND_URL}/charities`,
      metadata: {
        supabase_user_id: userId || 'guest', 
        charity_id: charityId,
        type: 'one_off_donation',
      },
    });
    
    res.json({ url: session.url });
  } catch (err) {
    console.error('[payments] Donation session error:', err.message);
    res.status(500).json({ error: 'Unable to start donation checkout.' });
  }
});

router.post('/cancel-subscription', requireAuth, async (req, res) => {
  try {
    const { stripe_subscription_id } = req.user;
    if (!stripe_subscription_id) return res.status(400).json({ error: 'No active subscription found' });

    await stripe.subscriptions.update(stripe_subscription_id, { cancel_at_period_end: true });
    await supabaseAdmin.from('profiles').update({ subscription_status: 'cancelled' }).eq('id', req.userId);

    res.json({ message: 'Subscription will cancel at end of billing period' });
  } catch (err) {
    res.status(500).json({ error: 'Unable to cancel subscription.' });
  }
});

router.post('/portal', requireAuth, async (req, res) => {
  try {
    const { stripe_customer_id } = req.user;
    if (!stripe_customer_id) return res.status(400).json({ error: 'No Stripe customer found' });

    const session = await stripe.billingPortal.sessions.create({
      customer: stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/dashboard`,
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: 'Unable to open billing portal.' });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`[webhook] Signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency: log the event
  await supabaseAdmin.from('subscription_events').insert([{
    stripe_event_id: event.id,
    event_type: event.type,
    event_data: event.data.object,
  }]);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        // --- Handle One-Off Donations ---
        if (session.mode === 'payment' && session.metadata?.type === 'one_off_donation') {
          const userId = session.metadata.supabase_user_id;
          const charityId = session.metadata.charity_id;
          const amount = (session.amount_total || 0) / 100;

          if (!charityId) break;

          if (userId && userId !== 'guest') {
            await supabaseAdmin.from('charity_contributions').insert([{
              user_id: userId,
              charity_id: charityId,
              amount: amount,
              contribution_percent: 100,
              subscription_period: new Date().toISOString().slice(0, 7),
              stripe_payment_id: session.payment_intent || session.id,
              status: 'completed',
            }]);
          }

          await syncCharityTotal(charityId, amount);
          break; 
        }

        // --- Handle Subscriptions ---
        if (session.mode !== 'subscription') break;

        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const metadata = (session.metadata && session.metadata.supabase_user_id) 
          ? session.metadata 
          : subscription.metadata;

        const userId       = metadata?.supabase_user_id;
        const plan         = metadata?.plan;
        const charityId    = metadata?.charity_id || null;
        const charityPct   = parseFloat(metadata?.charity_percent || '10');

        if (!userId) break;

        await supabaseAdmin.from('profiles').update({
          subscription_status:    'active',
          subscription_plan:      plan,
          stripe_subscription_id: subscription.id,
          subscription_start_date: new Date(subscription.current_period_start * 1000).toISOString(),
          subscription_end_date:   new Date(subscription.current_period_end * 1000).toISOString(),
          charity_id:              charityId,
          charity_contribution_percent: charityPct,
        }).eq('id', userId);

        if (charityId) {
          const totalAmount        = (session.amount_total || 0) / 100;
          const contributionAmount = parseFloat((totalAmount * charityPct / 100).toFixed(2));
          const paymentId          = session.payment_intent || session.id;

          const { data: existingContrib } = await supabaseAdmin
            .from('charity_contributions')
            .select('id')
            .eq('stripe_payment_id', paymentId)
            .single();

          if (!existingContrib) {
            const { error: contribError } = await supabaseAdmin.from('charity_contributions').insert([{
              user_id:               userId,
              charity_id:            charityId,
              amount:                contributionAmount,
              contribution_percent:  charityPct,
              subscription_period:   new Date().toISOString().slice(0, 7),
              stripe_payment_id:     paymentId,
              status:                'completed',
            }]);

            if (!contribError) await syncCharityTotal(charityId, contributionAmount);
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        if (!invoice.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) break;

        await supabaseAdmin.from('profiles')
          .update({
            subscription_status:  'active',
            subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
          }).eq('id', userId);

        if (invoice.billing_reason === 'subscription_cycle') {
          const { data: userProfile } = await supabaseAdmin
            .from('profiles')
            .select('charity_id, charity_contribution_percent')
            .eq('id', userId)
            .single();

          if (userProfile?.charity_id) {
            const renewalTotal       = (invoice.amount_paid || 0) / 100;
            const charityPct         = userProfile.charity_contribution_percent || 10;
            const contributionAmount = parseFloat((renewalTotal * charityPct / 100).toFixed(2));

            const { data: existingContrib } = await supabaseAdmin
              .from('charity_contributions')
              .select('id')
              .eq('stripe_payment_id', invoice.id)
              .single();

            if (!existingContrib) {
              const { error: renewContribError } = await supabaseAdmin.from('charity_contributions').insert([{
                user_id:              userId,
                charity_id:           userProfile.charity_id,
                amount:               contributionAmount,
                contribution_percent: charityPct,
                subscription_period:  new Date().toISOString().slice(0, 7),
                stripe_payment_id:    invoice.id,
                status:               'completed',
              }]);

              if (!renewContribError) await syncCharityTotal(userProfile.charity_id, contributionAmount);
            }
          }
        }
        break;
      }

      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const obj   = event.data.object;
        const subId = obj.id || obj.subscription;
        if (!subId) break;

        const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('stripe_subscription_id', subId).single();
        if (profile) {
          const newStatus = event.type === 'customer.subscription.deleted' ? 'cancelled' : 'lapsed';
          await supabaseAdmin.from('profiles').update({ subscription_status: newStatus }).eq('id', profile.id);
        }
        break;
      }
    }
  } catch (err) {
    console.error(`[webhook] Event processing error (${event.type}):`, err.message);
  }
  res.json({ received: true });
});

module.exports = router;