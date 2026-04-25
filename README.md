# 🏌️ Digital Heroes Golf Reward Platform — FINAL VERSION

> Play golf. Win rewards. Change lives.

A subscription-driven web application combining **golf performance tracking**, a **monthly draw-based reward engine**, and **charitable giving** — built as a full-stack submission for the Digital Heroes Developer Selection Challenge.

---

🛠️ Tech Stack
Frontend: React, Vite, Tailwind CSS, Framer Motion

Backend: Node.js, Express.js

Database & Auth: Supabase (PostgreSQL, Row Level Security, Storage)

Payments: Stripe Checkout & Webhooks

Hosting: Vercel (Serverless Functions & Static Hosting)

---

## 🗂️ Project Structure

```
golf-platform-final/
├── frontend/          # React + Vite + Tailwind + Framer Motion (deploy to Vercel)
├── backend/           # Node.js + Express API (deploy to Vercel)
└── database/          # Supabase PostgreSQL schema + RLS policies + email logs
```

---

## ✅ Full Requirement Checklist

| Requirement | Status |
|---|---|
| Anti-Golf emotion-driven UI | ✅ |
| Monthly + Yearly Stripe subscriptions | ✅ |
| Charity selection with 10% minimum | ✅ |
| Charity % voluntary increase from dashboard | ✅ Settings drawer slider |
| Rolling 5 score logic (DB trigger) | ✅ |
| One score per date constraint | ✅ |
| Stableford range 1–45 enforced | ✅ |
| Reverse chronological scores display | ✅ |
| Winner proof — real Supabase Storage upload | ✅ |
| 5 seed charities (platform feels alive) | ✅ |
| Subscription webhook (all states) | ✅ |
| Admin: user management + score view | ✅ |
| Admin: draw simulation mode | ✅ |
| Admin: random vs algorithmic draw toggle | ✅ |
| Admin: 40/35/25% prize pools + jackpot rollover | ✅ |
| Admin: inline proof image viewer (lightbox) | ✅ |
| Admin: mark-paid modal with reference field | ✅ |
| Admin: analytics dashboard | ✅ |
| Email: draw results notification | ✅ emailService.js |
| Email: winner alert | ✅ emailService.js |
| Email: payout approved notification | ✅ emailService.js |
| Mobile-first responsive design | ✅ |
| JWT + Supabase RLS | ✅ |

---

## 🗄️ Step 1 — Set Up Supabase

1. Go to [supabase.com](https://supabase.com) → Create a **brand new project**
2. Wait for provisioning (~2 mins)
3. Go to **SQL Editor** → run these files **in order**:
   - `database/schema.sql`
   - `database/rls_policies.sql`
   - `database/email_logs.sql`
4. Go to **Authentication → Settings** → enable Email/Password sign-in
5. Copy from **Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `anon/public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
6. Go to **Storage** → create two **public** buckets:
   - `winner-proofs`
   - `charity-assets`

### Make Yourself Admin
After signing up in the app, run in Supabase SQL Editor:
```sql
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'your-email@here.com';
```

---

## 💳 Step 2 — Set Up Stripe

1. Go to [stripe.com](https://stripe.com) → switch to **Test Mode**
2. **Products → Add Product**:
   - **Monthly**: ₹499 / month recurring → copy Price ID → `STRIPE_MONTHLY_PRICE_ID`
   - **Yearly**: ₹4999 / year recurring → copy Price ID → `STRIPE_YEARLY_PRICE_ID`
3. **Developers → API Keys** → copy Secret Key → `STRIPE_SECRET_KEY`
4. **Local webhook testing** (Stripe CLI):
   ```bash
   stripe listen --forward-to localhost:4000/api/payments/webhook
   ```
   Copy the printed signing secret → `STRIPE_WEBHOOK_SECRET`
5. **Production webhook** (Stripe Dashboard → Developers → Webhooks):
   - Endpoint URL: `https://your-backend.vercel.app/api/payments/webhook`
   - Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`

---

## 📧 Step 3 — Set Up Email (Optional but Recommended)

1. Sign up at [resend.com](https://resend.com) (free: 3,000 emails/month)
2. Get your API key → `RESEND_API_KEY`
3. In `backend/services/emailService.js`, uncomment the 3 Resend lines
4. Run `npm install resend` in the backend folder
5. Set `FROM_EMAIL` to a verified sender domain

Without this, emails are logged to the `email_logs` DB table but not actually sent — the app still works fully.

---

## 🖥️ Step 4 — Run Locally

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Fill in all values in .env
npm run dev
# → http://localhost:4000
# Test: curl http://localhost:4000/health
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
# Fill in:
# VITE_SUPABASE_URL=https://xxxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJ...
# VITE_API_URL=http://localhost:4000
npm run dev
# → http://localhost:5173
```

---

🚀 Live Environments
Frontend Application: https://apex-drive-frontend.vercel.app

Backend API: https://apex-drive-two.vercel.app

## 🧪 Full Testing Checklist

### User Flow
- [ ] Visit `/` — charity-first hero, animated floating numbers, pricing cards
- [ ] Sign up → verify email (or disable email confirm in Supabase for testing)
- [ ] Subscribe → choose plan → choose charity → adjust donation % slider → Stripe checkout
- [ ] Dashboard loads with subscription status, score panel, charity panel, winnings
- [ ] Add a score (1–45, with date) — appears at top in reverse chronological order
- [ ] Try duplicate date → error message shown
- [ ] Add 6th score → 5th oldest disappears automatically (rolling 5)
- [ ] Edit a score → value updates, date cannot change
- [ ] Delete a score
- [ ] Settings button → drawer opens with charity % slider → save → charity panel updates
- [ ] Billing portal button → redirects to Stripe customer portal

### Admin Flow
- [ ] Log in as admin → redirected to `/admin`
- [ ] Dashboard shows 6 stat cards (users, subscribers, prize pool, charity, paid out, pending)
- [ ] Users page → search by name/email → expand row → see scores
- [ ] Draws page → create new draw (pick month, year, type, pool amount)
- [ ] Simulate draw → numbers generated, matching run (no public publish yet)
- [ ] Publish draw → results appear on public `/draws` page, emails sent
- [ ] Payouts page → filter by `proof_submitted` → see thumbnail of proof
- [ ] Click thumbnail → lightbox opens with full-size image
- [ ] Approve proof → winner gets email notification
- [ ] Mark Paid → enter reference in modal → status updates to paid
- [ ] Charities page → add new charity (slug auto-generated from name)
- [ ] Edit charity → toggle featured → appears in homepage spotlight

### Edge Cases
- [ ] Non-subscriber tries to add score → blocked with subscription prompt
- [ ] Non-admin tries `/admin` URL → redirected to dashboard
- [ ] Score outside 1–45 → rejected (frontend + backend)
- [ ] Future date score → rejected by backend
- [ ] Stripe subscription cancelled → webhook sets status to `cancelled`
- [ ] No 5-match winner → jackpot_rollover=true, amount carried to next draw

---

## 🏗️ Architecture

```
Browser (React SPA)
    │
    ├── Supabase Auth (JWT issued on sign-in)
    │
    └── Express API on Vercel Serverless
            │
            ├── /api/scores        Rolling-5 CRUD (DB trigger enforces limit)
            ├── /api/draws         Draw engine: random + algorithmic + match
            ├── /api/payments      Stripe Checkout + full webhook handler
            ├── /api/charities     Public charity directory
            ├── /api/profiles      Profile settings + Supabase Storage proof upload
            └── /api/admin         Users, payouts, analytics, charities CRUD
                    │
                    └── Supabase PostgreSQL (7 tables + RLS)
                            ├── profiles (+ auto-create trigger)
                            ├── scores   (+ rolling-5 AFTER INSERT trigger)
                            ├── charities
                            ├── draws
                            ├── draw_entries
                            ├── payouts
                            ├── charity_contributions
                            └── email_logs
```

---

## 🔑 Key Files

| File | What it does |
|---|---|
| `database/schema.sql` | All tables, triggers (rolling-5, auto-profile), seed charities |
| `database/rls_policies.sql` | Row-level security — users only see their own data |
| `database/email_logs.sql` | Email audit log table |
| `backend/services/drawEngine.js` | Core: number generation, score matching, prize splitting, jackpot rollover |
| `backend/services/emailService.js` | HTML email templates: winner alert, draw results, payout approved |
| `backend/routes/scores.js` | Rolling-5 CRUD with all validations |
| `backend/routes/payments.js` | Stripe Checkout + webhook (all subscription states) |
| `frontend/src/pages/DashboardPage.jsx` | Full user dashboard + Settings drawer + real file upload |
| `frontend/src/pages/admin/AdminUsers.jsx` | All 4 admin pages including inline proof lightbox |

---
