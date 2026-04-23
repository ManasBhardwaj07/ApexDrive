-- ============================================================
-- Digital Heroes Golf Platform — Row Level Security Policies
-- Run AFTER schema.sql in Supabase SQL Editor
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charity_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- Helper function: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- PROFILES policies
-- ============================================================
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- ============================================================
-- SCORES policies
-- ============================================================
CREATE POLICY "Users can view their own scores"
  ON public.scores FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can insert their own scores"
  ON public.scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scores"
  ON public.scores FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can delete their own scores"
  ON public.scores FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- CHARITIES policies  (public read, admin write)
-- ============================================================
CREATE POLICY "Anyone can view active charities"
  ON public.charities FOR SELECT
  USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "Admins can insert charities"
  ON public.charities FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update charities"
  ON public.charities FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete charities"
  ON public.charities FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- DRAWS policies
-- ============================================================
CREATE POLICY "Users can view published draws"
  ON public.draws FOR SELECT
  USING (status IN ('published', 'completed') OR public.is_admin());

CREATE POLICY "Admins can manage draws"
  ON public.draws FOR ALL
  USING (public.is_admin());

-- ============================================================
-- DRAW_ENTRIES policies
-- ============================================================
CREATE POLICY "Users can view their own draw entries"
  ON public.draw_entries FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "System can insert draw entries"
  ON public.draw_entries FOR INSERT
  WITH CHECK (public.is_admin());

-- ============================================================
-- PAYOUTS policies
-- ============================================================
CREATE POLICY "Users can view their own payouts"
  ON public.payouts FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can submit proof for their payouts"
  ON public.payouts FOR UPDATE
  USING (
    auth.uid() = user_id AND
    status = 'pending'
  )
  WITH CHECK (
    status = 'proof_submitted' AND
    proof_url IS NOT NULL
  );

CREATE POLICY "Admins can manage all payouts"
  ON public.payouts FOR ALL
  USING (public.is_admin());

-- ============================================================
-- CHARITY_CONTRIBUTIONS policies
-- ============================================================
CREATE POLICY "Users can view their own contributions"
  ON public.charity_contributions FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Service role can insert contributions"
  ON public.charity_contributions FOR INSERT
  WITH CHECK (TRUE);  -- Backend service role handles inserts via webhook

-- ============================================================
-- SUBSCRIPTION_EVENTS policies (admin only)
-- ============================================================
CREATE POLICY "Admins can view subscription events"
  ON public.subscription_events FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Service role can insert subscription events"
  ON public.subscription_events FOR INSERT
  WITH CHECK (TRUE);
