-- ============================================================
-- Digital Heroes Golf Reward Platform — Supabase Schema
-- Version 1.0 | Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  country TEXT DEFAULT 'IN',
  handicap NUMERIC(4,1),
  subscription_status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (subscription_status IN ('active', 'inactive', 'cancelled', 'lapsed')),
  subscription_plan TEXT CHECK (subscription_plan IN ('monthly', 'yearly')),
  subscription_start_date TIMESTAMPTZ,
  subscription_end_date TIMESTAMPTZ,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  charity_id UUID,
  charity_contribution_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00
    CHECK (charity_contribution_percent >= 10 AND charity_contribution_percent <= 100),
  role TEXT NOT NULL DEFAULT 'subscriber' CHECK (role IN ('subscriber', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: charities
-- ============================================================
CREATE TABLE IF NOT EXISTS public.charities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  short_description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  website TEXT,
  registered_number TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  total_received NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  upcoming_events JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from profiles to charities
ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_charity
  FOREIGN KEY (charity_id) REFERENCES public.charities(id) ON DELETE SET NULL;

-- ============================================================
-- TABLE: scores
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 45),
  score_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, score_date)  -- One score per date per user
);

-- Index for fast user score lookups ordered by date
CREATE INDEX idx_scores_user_date ON public.scores(user_id, score_date DESC);

-- ============================================================
-- FUNCTION: enforce_rolling_5_scores
-- Keeps only the latest 5 scores per user — deletes oldest on insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_rolling_5_scores()
RETURNS TRIGGER AS $$
BEGIN
  -- After inserting a new score, delete any beyond the latest 5
  DELETE FROM public.scores
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id
      FROM public.scores
      WHERE user_id = NEW.user_id
      ORDER BY score_date DESC, created_at DESC
      LIMIT 5
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_rolling_5_scores
  AFTER INSERT ON public.scores
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_rolling_5_scores();

-- ============================================================
-- TABLE: draws
-- ============================================================
CREATE TABLE IF NOT EXISTS public.draws (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_month INTEGER NOT NULL CHECK (draw_month BETWEEN 1 AND 12),
  draw_year INTEGER NOT NULL,
  draw_numbers INTEGER[] NOT NULL,                   -- The 5 drawn numbers
  draw_type TEXT NOT NULL DEFAULT 'random'
    CHECK (draw_type IN ('random', 'algorithmic')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'simulated', 'published', 'completed')),
  prize_pool_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  jackpot_pool NUMERIC(12,2) NOT NULL DEFAULT 0.00,  -- 40% (can rollover)
  match4_pool NUMERIC(12,2) NOT NULL DEFAULT 0.00,   -- 35%
  match3_pool NUMERIC(12,2) NOT NULL DEFAULT 0.00,   -- 25%
  jackpot_rollover BOOLEAN NOT NULL DEFAULT FALSE,    -- TRUE if carried forward
  rollover_amount NUMERIC(12,2) DEFAULT 0.00,         -- Amount from prev month
  admin_notes TEXT,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(draw_month, draw_year)
);

-- ============================================================
-- TABLE: draw_entries
-- Links a user's score snapshot to a draw for matching
-- ============================================================
CREATE TABLE IF NOT EXISTS public.draw_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_id UUID NOT NULL REFERENCES public.draws(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_numbers INTEGER[] NOT NULL,    -- User's 5 scores at draw time
  match_count INTEGER DEFAULT 0,       -- 0, 3, 4, or 5
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  prize_amount NUMERIC(12,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(draw_id, user_id)
);

-- ============================================================
-- TABLE: payouts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_entry_id UUID NOT NULL REFERENCES public.draw_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  draw_id UUID NOT NULL REFERENCES public.draws(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL CHECK (match_type IN ('5-match', '4-match', '3-match')),
  gross_amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'proof_submitted', 'approved', 'rejected', 'paid')),
  proof_url TEXT,
  proof_submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: charity_contributions
-- Tracks every contribution per subscription cycle
-- ============================================================
CREATE TABLE IF NOT EXISTS public.charity_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  charity_id UUID NOT NULL REFERENCES public.charities(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  contribution_percent NUMERIC(5,2) NOT NULL,
  subscription_period TEXT,        -- e.g. "2026-04"
  stripe_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: subscription_events  (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  stripe_event_id TEXT UNIQUE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- UPDATED_AT triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_scores_updated_at
  BEFORE UPDATE ON public.scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_draws_updated_at
  BEFORE UPDATE ON public.draws
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_charities_updated_at
  BEFORE UPDATE ON public.charities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- FUNCTION: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SEED: Default charities
-- ============================================================
INSERT INTO public.charities (name, slug, description, short_description, is_featured, is_active) VALUES
  (
    'Green Future Foundation',
    'green-future',
    'Dedicated to reforestation and environmental conservation across South Asia. Every contribution helps plant trees and restore ecosystems.',
    'Reforestation & conservation across South Asia',
    TRUE, TRUE
  ),
  (
    'Children First India',
    'children-first',
    'Providing quality education, nutrition, and healthcare to underprivileged children in rural India.',
    'Education & health for rural children',
    TRUE, TRUE
  ),
  (
    'SportAbility Trust',
    'sport-ability',
    'Enabling differently-abled individuals to participate in sports at all levels — local, national, and international.',
    'Sports inclusion for differently-abled people',
    FALSE, TRUE
  ),
  (
    'Rural Health Connect',
    'rural-health',
    'Bridging the healthcare gap in underserved rural communities through mobile clinics and telemedicine.',
    'Mobile healthcare for rural communities',
    FALSE, TRUE
  ),
  (
    'Women Entrepreneurs Fund',
    'women-entrepreneurs',
    'Micro-financing and mentorship for women-led businesses in tier-2 and tier-3 cities.',
    'Micro-finance & mentorship for women founders',
    FALSE, TRUE
  );
