const { supabaseAdmin } = require('../config/supabase');
const { Resend } = require('resend');

const resend    = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const APP_NAME   = 'Digital Heroes Golf';

if (!process.env.RESEND_API_KEY) {
  console.warn('[EMAIL] ⚠️ RESEND_API_KEY is not set. Emails will not be sent.');
}

/**
 * Core send — Silent on success, loud on failure.
 */
async function sendEmail({ to, subject, html, userId = null }) {
  try {
    await supabaseAdmin
      .from('email_logs')
      .insert({
        to_email:  to,
        subject,
        body_html: html,
        user_id:   userId,
        status:    'queued',
      });
  } catch (err) {
    console.error(`[EMAIL] DB log insert failed for ${to}:`, err.message);
  }

  if (!process.env.RESEND_API_KEY) return;

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (result.error) {
      console.error(`[EMAIL] ❌ Failed to send to ${to}:`, result.error.message);
      await supabaseAdmin.from('email_logs').update({ status: 'failed' }).eq('to_email', to).eq('subject', subject);
      return;
    }

    await supabaseAdmin.from('email_logs').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('to_email', to).eq('subject', subject);

  } catch (err) {
    console.error(`[EMAIL] ❌ Exception sending to ${to}:`, err.message);
    await supabaseAdmin.from('email_logs').update({ status: 'failed' }).eq('to_email', to).eq('subject', subject);
  }
}

// ── Email Templates ──────────────────────────────────────────

async function notifyWinner({ email, fullName, matchType, prizeAmount, userId }) {
  if (!email) return;
  const subject = `🏆 You won ₹${prizeAmount.toLocaleString('en-IN')} — ${APP_NAME}`;
  const html = `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d2920;color:#F5F0E8;padding:40px;border-radius:16px;">
      <h1 style="font-family:Georgia,serif;color:#D4A853;">You won! 🏆</h1>
      <p>Hi ${fullName || 'Player'},</p>
      <p>Congratulations! You matched numbers for the ${matchType} and won ₹${prizeAmount.toLocaleString('en-IN')}.</p>
      <a href="${process.env.FRONTEND_URL}/dashboard" style="display:inline-block;background:#D4A853;color:#0d2920;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;">Claim Prize →</a>
    </div>
  `;
  await sendEmail({ to: email, subject, html, userId });
}

async function notifyDrawPublished({ drawMonth, drawYear, drawNumbers }) {
  const { data: subscribers, error } = await supabaseAdmin
    .from('profiles')
    .select('email, full_name, id')
    .eq('subscription_status', 'active');

  if (error || !subscribers?.length) return;

  const monthName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][drawMonth - 1];
  const subject   = `Draw Results: ${monthName} ${drawYear} — ${APP_NAME}`;

  for (const sub of subscribers) {
    const html = `
      <div style="font-family:'DM Sans',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d2920;color:#F5F0E8;padding:40px;border-radius:16px;">
        <h1 style="color:#D4A853;">${monthName} ${drawYear} Draw Results</h1>
        <p>The winning numbers are: <strong>${drawNumbers.join(', ')}</strong></p>
      </div>
    `;
    await sendEmail({ to: sub.email, subject, html, userId: sub.id });
  }
}

async function notifyPayoutApproved({ email, fullName, prizeAmount, userId }) {
  if (!email) return;
  const subject = `✅ Your prize payment is approved — ${APP_NAME}`;
  const html = `<h1>Your ₹${prizeAmount} payment has been approved and is processing.</h1>`;
  await sendEmail({ to: email, subject, html, userId });
}

module.exports = { notifyWinner, notifyDrawPublished, notifyPayoutApproved };