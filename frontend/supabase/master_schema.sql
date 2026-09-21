-- =============================================
-- FILE: 20260719122240_2eaff6e7-4ec1-4d6f-b884-a39594dc082a.sql
-- =============================================

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE public.request_category AS ENUM ('grocery','elderly_care','transportation','errand','first_aid','other');
CREATE TYPE public.urgency_level    AS ENUM ('normal','today','emergency');
CREATE TYPE public.request_status   AS ENUM ('open','accepted','in_progress','completed','cancelled');
CREATE TYPE public.payment_status   AS ENUM ('pending','held','released','refunded');
CREATE TYPE public.payout_status    AS ENUM ('requested','approved','rejected','paid');
CREATE TYPE public.notification_type AS ENUM ('new_request_nearby','request_accepted','new_message','status_changed','request_completed','payout_update');

-- ============================================================
-- updated_at helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone_number TEXT,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  bio TEXT,
  profile_photo_url TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  location geography(Point, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX profiles_location_gix ON public.profiles USING GIST (location);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- is_admin helper (only depends on profiles)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = _user_id), false);
$$;

CREATE POLICY "profiles read active or self or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (is_active = true OR id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles update self" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles insert self" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles admin update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone_number, phone_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email,''), '@', 1)),
    NEW.phone,
    NEW.phone_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- user_offer_tags
-- ============================================================
CREATE TABLE public.user_offer_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tag)
);
CREATE INDEX user_offer_tags_user_idx ON public.user_offer_tags(user_id);
CREATE INDEX user_offer_tags_tag_idx  ON public.user_offer_tags(tag);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_offer_tags TO authenticated;
GRANT ALL ON public.user_offer_tags TO service_role;
ALTER TABLE public.user_offer_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offer_tags read all" ON public.user_offer_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "offer_tags manage self" ON public.user_offer_tags
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- pricing_rules
-- ============================================================
CREATE TABLE public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.request_category NOT NULL UNIQUE,
  base_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  rate_per_km NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pricing_rules TO authenticated, anon;
GRANT ALL ON public.pricing_rules TO service_role;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing read all" ON public.pricing_rules FOR SELECT USING (true);
CREATE POLICY "pricing admin write" ON public.pricing_rules
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.pricing_rules (category, base_fee, rate_per_km, commission_rate) VALUES
  ('grocery',        60, 10, 0.15),
  ('elderly_care',  120, 10, 0.15),
  ('transportation', 40, 15, 0.15),
  ('errand',         50, 10, 0.15),
  ('first_aid',      80, 10, 0.10),
  ('other',          50, 10, 0.15);

-- ============================================================
-- help_requests
-- ============================================================
CREATE TABLE public.help_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  helper_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category public.request_category NOT NULL DEFAULT 'other',
  urgency  public.urgency_level    NOT NULL DEFAULT 'normal',
  status   public.request_status   NOT NULL DEFAULT 'open',
  ai_suggested_category public.request_category,
  ai_suggested_urgency  public.urgency_level,
  ai_confidence NUMERIC(4,3),
  is_paid BOOLEAN NOT NULL DEFAULT true,
  estimated_fare NUMERIC(10,2),
  final_fare NUMERIC(10,2),
  commission_amount NUMERIC(10,2),
  payment_id UUID,
  photo_url TEXT,
  location geography(Point, 4326),
  address_text TEXT,
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT emergency_is_free CHECK (urgency <> 'emergency' OR is_paid = false)
);
CREATE INDEX help_requests_status_idx    ON public.help_requests(status);
CREATE INDEX help_requests_urgency_idx   ON public.help_requests(urgency);
CREATE INDEX help_requests_location_gix  ON public.help_requests USING GIST (location);
CREATE INDEX help_requests_requester_idx ON public.help_requests(requester_id);
CREATE INDEX help_requests_helper_idx    ON public.help_requests(helper_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_requests TO authenticated;
GRANT ALL ON public.help_requests TO service_role;
ALTER TABLE public.help_requests ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER help_requests_set_updated_at BEFORE UPDATE ON public.help_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- is_request_party helper (now that help_requests exists)
CREATE OR REPLACE FUNCTION public.is_request_party(_request_id uuid, _user_id uuid)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.help_requests
    WHERE id = _request_id AND (requester_id = _user_id OR helper_id = _user_id)
  );
$$;

CREATE POLICY "help_requests read open or party or admin" ON public.help_requests
  FOR SELECT TO authenticated
  USING (status = 'open' OR requester_id = auth.uid() OR helper_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "help_requests insert self" ON public.help_requests
  FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
CREATE POLICY "help_requests update party or admin" ON public.help_requests
  FOR UPDATE TO authenticated
  USING (requester_id = auth.uid() OR helper_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (requester_id = auth.uid() OR helper_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "help_requests delete requester when open" ON public.help_requests
  FOR DELETE TO authenticated USING (requester_id = auth.uid() AND status = 'open');

-- ============================================================
-- request_status_history
-- ============================================================
CREATE TABLE public.request_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.help_requests(id) ON DELETE CASCADE,
  old_status public.request_status,
  new_status public.request_status NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rsh_request_idx ON public.request_status_history(request_id);
GRANT SELECT, INSERT ON public.request_status_history TO authenticated;
GRANT ALL ON public.request_status_history TO service_role;
ALTER TABLE public.request_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rsh read party or admin" ON public.request_status_history
  FOR SELECT TO authenticated
  USING (public.is_request_party(request_id, auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "rsh insert party" ON public.request_status_history
  FOR INSERT TO authenticated
  WITH CHECK (public.is_request_party(request_id, auth.uid()) OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO public.request_status_history(request_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER help_requests_log_status_change
AFTER UPDATE OF status ON public.help_requests
FOR EACH ROW EXECUTE FUNCTION public.log_status_change();

-- ============================================================
-- chat_threads
-- ============================================================
CREATE TABLE public.chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES public.help_requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_threads read party" ON public.chat_threads
  FOR SELECT TO authenticated
  USING (public.is_request_party(request_id, auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "chat_threads insert party" ON public.chat_threads
  FOR INSERT TO authenticated
  WITH CHECK (public.is_request_party(request_id, auth.uid()));

-- ============================================================
-- chat_messages
-- ============================================================
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_thread_idx ON public.chat_messages(thread_id, created_at);
GRANT SELECT, INSERT, UPDATE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_thread_party(_thread_id uuid, _user_id uuid)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_threads t
    JOIN public.help_requests r ON r.id = t.request_id
    WHERE t.id = _thread_id AND (r.requester_id = _user_id OR r.helper_id = _user_id)
  );
$$;

CREATE POLICY "chat_messages read party" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (public.is_thread_party(thread_id, auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "chat_messages insert party" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_thread_party(thread_id, auth.uid()));
CREATE POLICY "chat_messages update mark read" ON public.chat_messages
  FOR UPDATE TO authenticated
  USING (public.is_thread_party(thread_id, auth.uid()))
  WITH CHECK (public.is_thread_party(thread_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- ============================================================
-- notifications
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  request_id UUID REFERENCES public.help_requests(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications read self" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications update self" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications delete self" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());
-- Inserts go through SECURITY DEFINER paths (triggers, RPCs).

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ============================================================
-- ratings
-- ============================================================
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.help_requests(id) ON DELETE CASCADE,
  rater_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ratee_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, rater_id)
);
CREATE INDEX ratings_ratee_idx ON public.ratings(ratee_id);
GRANT SELECT, INSERT ON public.ratings TO authenticated;
GRANT SELECT ON public.ratings TO anon;
GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings read all" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "ratings insert party completed" ON public.ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    rater_id = auth.uid()
    AND ratee_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.help_requests r
      WHERE r.id = request_id
        AND r.status = 'completed'
        AND (r.requester_id = auth.uid() OR r.helper_id = auth.uid())
        AND (r.requester_id = ratee_id OR r.helper_id = ratee_id)
    )
  );

-- ============================================================
-- moderation_flags
-- ============================================================
CREATE TABLE public.moderation_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flagged_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.moderation_flags TO authenticated;
GRANT ALL ON public.moderation_flags TO service_role;
ALTER TABLE public.moderation_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flags admin read" ON public.moderation_flags
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "flags insert self" ON public.moderation_flags
  FOR INSERT TO authenticated WITH CHECK (flagged_by = auth.uid());
CREATE POLICY "flags admin update" ON public.moderation_flags
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- payments
-- ============================================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES public.help_requests(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  amount NUMERIC(10,2) NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "payments read party or admin" ON public.payments
  FOR SELECT TO authenticated
  USING (public.is_request_party(request_id, auth.uid()) OR public.is_admin(auth.uid()));
-- All writes go through SECURITY DEFINER RPCs; no user INSERT/UPDATE policies.

ALTER TABLE public.help_requests
  ADD CONSTRAINT help_requests_payment_id_fkey
  FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;

-- ============================================================
-- wallets
-- ============================================================
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER wallets_set_updated_at BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "wallets read self or admin" ON public.wallets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- ============================================================
-- payouts
-- ============================================================
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status public.payout_status NOT NULL DEFAULT 'requested',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX payouts_wallet_idx ON public.payouts(wallet_id);
GRANT SELECT, INSERT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payouts read own or admin" ON public.payouts
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = wallet_id AND w.user_id = auth.uid())
  );
CREATE POLICY "payouts insert own" ON public.payouts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = wallet_id AND w.user_id = auth.uid()));

-- ============================================================
-- Nearby-notifications trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_nearby_helpers()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_msg TEXT;
BEGIN
  v_msg := 'New ' || NEW.category::text || ' request nearby: ' || NEW.title;
  INSERT INTO public.notifications (user_id, type, request_id, message)
  SELECT DISTINCT p.id, 'new_request_nearby', NEW.id, v_msg
  FROM public.profiles p
  JOIN public.user_offer_tags t ON t.user_id = p.id
  WHERE p.is_active = true
    AND p.id <> NEW.requester_id
    AND t.tag = NEW.category::text
    AND p.location IS NOT NULL
    AND NEW.location IS NOT NULL
    AND ST_DWithin(p.location, NEW.location, 5000);
  RETURN NEW;
END; $$;
CREATE TRIGGER help_requests_notify_nearby
AFTER INSERT ON public.help_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_nearby_helpers();

-- ============================================================
-- Nearby-feed function
-- ============================================================
CREATE OR REPLACE FUNCTION public.nearby_open_requests(
  _lat DOUBLE PRECISION,
  _lng DOUBLE PRECISION,
  _radius_m INTEGER DEFAULT 5000,
  _category public.request_category DEFAULT NULL,
  _urgency  public.urgency_level    DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  requester_id UUID,
  title TEXT,
  description TEXT,
  category public.request_category,
  urgency  public.urgency_level,
  is_paid BOOLEAN,
  estimated_fare NUMERIC,
  photo_url TEXT,
  address_text TEXT,
  distance_m DOUBLE PRECISION,
  created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    r.id, r.requester_id, r.title, r.description, r.category, r.urgency,
    r.is_paid, r.estimated_fare, r.photo_url, r.address_text,
    ST_Distance(r.location, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography) AS distance_m,
    r.created_at
  FROM public.help_requests r
  WHERE r.status = 'open'
    AND r.location IS NOT NULL
    AND (_category IS NULL OR r.category = _category)
    AND (_urgency  IS NULL OR r.urgency  = _urgency)
    AND ST_DWithin(r.location, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography, _radius_m)
  ORDER BY
    CASE r.urgency WHEN 'emergency' THEN 0 WHEN 'today' THEN 1 ELSE 2 END,
    distance_m ASC;
$$;
GRANT EXECUTE ON FUNCTION public.nearby_open_requests(double precision,double precision,integer,public.request_category,public.urgency_level) TO authenticated;

-- ============================================================
-- Atomic payment capture RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.capture_payment(
  _payment_id UUID,
  _razorpay_payment_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  payment_id UUID,
  request_id UUID,
  amount NUMERIC,
  commission NUMERIC,
  helper_credit NUMERIC,
  helper_id UUID,
  wallet_balance NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment  public.payments%ROWTYPE;
  v_request  public.help_requests%ROWTYPE;
  v_rate     NUMERIC;
  v_commission NUMERIC(10,2);
  v_credit     NUMERIC(10,2);
  v_balance    NUMERIC(12,2);
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found'; END IF;

  IF v_payment.status = 'released' THEN
    SELECT * INTO v_request FROM public.help_requests WHERE id = v_payment.request_id;
    SELECT balance INTO v_balance FROM public.wallets WHERE user_id = v_request.helper_id;
    payment_id := v_payment.id;
    request_id := v_payment.request_id;
    amount     := v_payment.amount;
    commission := v_request.commission_amount;
    helper_credit := v_payment.amount - COALESCE(v_request.commission_amount, 0);
    helper_id  := v_request.helper_id;
    wallet_balance := COALESCE(v_balance, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_payment.status NOT IN ('pending','held') THEN
    RAISE EXCEPTION 'payment_not_capturable:%', v_payment.status;
  END IF;

  SELECT * INTO v_request FROM public.help_requests WHERE id = v_payment.request_id FOR UPDATE;
  IF v_request.helper_id IS NULL THEN RAISE EXCEPTION 'request_has_no_helper'; END IF;

  SELECT commission_rate INTO v_rate FROM public.pricing_rules WHERE category = v_request.category;
  v_rate := COALESCE(v_rate, 0.10);
  v_commission := ROUND(v_payment.amount * v_rate, 2);
  v_credit     := v_payment.amount - v_commission;

  UPDATE public.payments
    SET status = 'released',
        razorpay_payment_id = COALESCE(_razorpay_payment_id, razorpay_payment_id)
    WHERE id = v_payment.id;

  UPDATE public.help_requests
    SET final_fare = v_payment.amount,
        commission_amount = v_commission
    WHERE id = v_payment.request_id;

  INSERT INTO public.wallets(user_id, balance)
    VALUES (v_request.helper_id, v_credit)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now()
    RETURNING balance INTO v_balance;

  INSERT INTO public.notifications(user_id, type, request_id, message) VALUES
    (v_request.helper_id, 'request_completed', v_request.id, 'Payment released to your wallet: ' || v_credit),
    (v_request.requester_id, 'request_completed', v_request.id, 'Payment captured. Thank you!');

  payment_id := v_payment.id;
  request_id := v_payment.request_id;
  amount     := v_payment.amount;
  commission := v_commission;
  helper_credit := v_credit;
  helper_id  := v_request.helper_id;
  wallet_balance := v_balance;
  RETURN NEXT;
END; $$;

REVOKE ALL ON FUNCTION public.capture_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.capture_payment(uuid, text) TO authenticated, service_role;

-- ============================================================
-- Payout status RPC (admin-only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_set_payout_status(_payout_id uuid, _new_status public.payout_status)
RETURNS public.payouts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payout public.payouts%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_payout FROM public.payouts WHERE id = _payout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payout_not_found'; END IF;

  IF _new_status = 'paid' AND v_payout.status <> 'paid' THEN
    SELECT * INTO v_wallet FROM public.wallets WHERE id = v_payout.wallet_id FOR UPDATE;
    IF v_wallet.balance < v_payout.amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
    UPDATE public.wallets SET balance = balance - v_payout.amount, updated_at = now() WHERE id = v_wallet.id;
  END IF;

  UPDATE public.payouts
    SET status = _new_status,
        processed_at = CASE WHEN _new_status IN ('approved','rejected','paid') THEN now() ELSE processed_at END
    WHERE id = _payout_id
    RETURNING * INTO v_payout;

  INSERT INTO public.notifications(user_id, type, request_id, message)
  SELECT w.user_id, 'payout_update', NULL, 'Payout ' || _new_status::text || ': ' || v_payout.amount
  FROM public.wallets w WHERE w.id = v_payout.wallet_id;

  RETURN v_payout;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_payout_status(uuid, public.payout_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_payout_status(uuid, public.payout_status) TO authenticated, service_role;

-- ============================================================
-- Aggregate rating helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_rating_summary(_user_id uuid)
RETURNS TABLE (avg_score NUMERIC, rating_count BIGINT)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT ROUND(AVG(score)::numeric, 2), COUNT(*)::BIGINT
  FROM public.ratings WHERE ratee_id = _user_id;
$$;
GRANT EXECUTE ON FUNCTION public.user_rating_summary(uuid) TO authenticated, anon;


-- =============================================
-- FILE: 20260719122331_10280a1a-8343-4f49-8a21-41f43aa79ac6.sql
-- =============================================

-- Trigger-only functions: no one calls them directly
REVOKE ALL ON FUNCTION public.set_updated_at()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user()         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_status_change()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_nearby_helpers()   FROM PUBLIC, anon, authenticated;

-- Policy helpers: only authenticated needs EXECUTE (RLS evaluation)
REVOKE ALL ON FUNCTION public.is_admin(uuid)                     FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid)                  TO authenticated;

REVOKE ALL ON FUNCTION public.is_request_party(uuid, uuid)       FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_request_party(uuid, uuid)    TO authenticated;

REVOKE ALL ON FUNCTION public.is_thread_party(uuid, uuid)        FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_thread_party(uuid, uuid)     TO authenticated;


-- =============================================
-- FILE: 20260719122444_0db6b876-0ad5-430b-9435-92838555a5fc.sql
-- =============================================

CREATE OR REPLACE FUNCTION public.accept_help_request(
  _request_id UUID,
  _order_id   TEXT DEFAULT NULL
)
RETURNS TABLE (
  request_id UUID,
  payment_id UUID,
  chat_thread_id UUID,
  is_paid BOOLEAN,
  amount NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_helper UUID := auth.uid();
  v_request public.help_requests%ROWTYPE;
  v_thread_id UUID;
  v_payment_id UUID;
BEGIN
  IF v_helper IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- Race-safe claim
  UPDATE public.help_requests
     SET status = 'accepted',
         helper_id = v_helper,
         accepted_at = now()
   WHERE id = _request_id
     AND status = 'open'
     AND requester_id <> v_helper
  RETURNING * INTO v_request;

  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_available'; END IF;

  -- Chat thread
  INSERT INTO public.chat_threads(request_id) VALUES (v_request.id)
    ON CONFLICT (request_id) DO UPDATE SET request_id = EXCLUDED.request_id
    RETURNING id INTO v_thread_id;

  -- Payment (only for paid requests)
  IF v_request.is_paid AND v_request.estimated_fare IS NOT NULL AND v_request.estimated_fare > 0 THEN
    INSERT INTO public.payments(request_id, payer_id, amount, status, razorpay_order_id)
    VALUES (v_request.id, v_request.requester_id, v_request.estimated_fare, 'pending',
            COALESCE(_order_id, 'sim_order_' || gen_random_uuid()::text))
    RETURNING id INTO v_payment_id;

    UPDATE public.help_requests SET payment_id = v_payment_id WHERE id = v_request.id;
  END IF;

  -- Notify requester
  INSERT INTO public.notifications(user_id, type, request_id, message)
  VALUES (v_request.requester_id, 'request_accepted', v_request.id,
          'Your request "' || v_request.title || '" was accepted.');

  request_id := v_request.id;
  payment_id := v_payment_id;
  chat_thread_id := v_thread_id;
  is_paid := v_request.is_paid;
  amount := v_request.estimated_fare;
  RETURN NEXT;
END; $$;

REVOKE ALL ON FUNCTION public.accept_help_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_help_request(uuid, text) TO authenticated;

-- Convenience: notification insert helper for status changes / messages
-- (used by server functions for the party that isn't the caller)
CREATE OR REPLACE FUNCTION public.insert_notification(
  _user_id UUID, _type public.notification_type, _request_id UUID, _message TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  -- Only allow notifying the counter-party of a request the caller is on
  IF _request_id IS NULL OR NOT public.is_request_party(_request_id, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.notifications(user_id, type, request_id, message)
  VALUES (_user_id, _type, _request_id, _message) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.insert_notification(uuid, public.notification_type, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_notification(uuid, public.notification_type, uuid, text) TO authenticated;


-- =============================================
-- FILE: 20260719123530_d2873220-f785-42fe-b3eb-852d7006b38a.sql
-- =============================================
-- Trigger fix (main blocker for createHelpRequest)
CREATE OR REPLACE FUNCTION public.notify_nearby_helpers()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_msg TEXT;
BEGIN
  v_msg := 'New ' || NEW.category::text || ' request nearby: ' || NEW.title;
  INSERT INTO public.notifications (user_id, type, request_id, message)
  SELECT DISTINCT p.id, 'new_request_nearby'::public.notification_type, NEW.id, v_msg
  FROM public.profiles p
  JOIN public.user_offer_tags t ON t.user_id = p.id
  WHERE p.is_active = true
    AND p.id <> NEW.requester_id
    AND t.tag = NEW.category::text
    AND p.location IS NOT NULL
    AND NEW.location IS NOT NULL
    AND ST_DWithin(p.location, NEW.location, 5000);
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_nearby_helpers() FROM PUBLIC, anon, authenticated;

-- capture_payment: drop then recreate to change body only
DROP FUNCTION IF EXISTS public.capture_payment(uuid, text);
CREATE FUNCTION public.capture_payment(_payment_id uuid, _razorpay_payment_id text)
RETURNS TABLE (
  payment_id uuid, request_id uuid, amount numeric,
  commission numeric, helper_credit numeric, helper_id uuid, wallet_balance numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_request public.help_requests%ROWTYPE;
  v_commission numeric(12,2);
  v_credit numeric(12,2);
  v_balance numeric(12,2);
  v_helper uuid;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found'; END IF;

  IF v_payment.status = 'released' THEN
    SELECT r.helper_id, w.balance INTO v_helper, v_balance
      FROM public.help_requests r
      LEFT JOIN public.wallets w ON w.user_id = r.helper_id
      WHERE r.id = v_payment.request_id;
    payment_id := v_payment.id;
    request_id := v_payment.request_id;
    amount := v_payment.amount;
    commission := ROUND(v_payment.amount * 0.10, 2);
    helper_credit := v_payment.amount - commission;
    helper_id := v_helper;
    wallet_balance := COALESCE(v_balance, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_request FROM public.help_requests WHERE id = v_payment.request_id FOR UPDATE;
  IF v_request.helper_id IS NULL THEN RAISE EXCEPTION 'no_helper_assigned'; END IF;

  v_commission := ROUND(v_payment.amount * 0.10, 2);
  v_credit := v_payment.amount - v_commission;

  UPDATE public.payments
    SET status = 'released',
        razorpay_payment_id = COALESCE(_razorpay_payment_id, razorpay_payment_id),
        updated_at = now()
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;

  UPDATE public.help_requests
    SET final_fare = v_payment.amount, commission_amount = v_commission, updated_at = now()
    WHERE id = v_request.id;

  INSERT INTO public.wallets(user_id, balance)
    VALUES (v_request.helper_id, v_credit)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now()
    RETURNING balance INTO v_balance;

  INSERT INTO public.notifications(user_id, type, request_id, message) VALUES
    (v_request.helper_id,   'request_completed'::public.notification_type, v_request.id, 'Payment released to your wallet: ' || v_credit),
    (v_request.requester_id,'request_completed'::public.notification_type, v_request.id, 'Payment captured. Thank you!');

  payment_id := v_payment.id;
  request_id := v_payment.request_id;
  amount     := v_payment.amount;
  commission := v_commission;
  helper_credit := v_credit;
  helper_id  := v_request.helper_id;
  wallet_balance := v_balance;
  RETURN NEXT;
END; $$;
REVOKE ALL ON FUNCTION public.capture_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.capture_payment(uuid, text) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.admin_set_payout_status(uuid, public.payout_status);
CREATE FUNCTION public.admin_set_payout_status(_payout_id uuid, _new_status public.payout_status)
RETURNS public.payouts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payout public.payouts%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_payout FROM public.payouts WHERE id = _payout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payout_not_found'; END IF;

  IF _new_status = 'paid' AND v_payout.status <> 'paid' THEN
    SELECT * INTO v_wallet FROM public.wallets WHERE id = v_payout.wallet_id FOR UPDATE;
    IF v_wallet.balance < v_payout.amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
    UPDATE public.wallets SET balance = balance - v_payout.amount, updated_at = now() WHERE id = v_wallet.id;
  END IF;

  UPDATE public.payouts
    SET status = _new_status,
        processed_at = CASE WHEN _new_status IN ('approved','rejected','paid') THEN now() ELSE processed_at END
    WHERE id = _payout_id
    RETURNING * INTO v_payout;

  INSERT INTO public.notifications(user_id, type, request_id, message)
  SELECT w.user_id, 'payout_update'::public.notification_type, NULL, 'Payout ' || _new_status::text || ': ' || v_payout.amount
  FROM public.wallets w WHERE w.id = v_payout.wallet_id;

  RETURN v_payout;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_payout_status(uuid, public.payout_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_payout_status(uuid, public.payout_status) TO authenticated, service_role;

-- =============================================
-- FILE: 20260719170020_0130a601-5429-46cd-92fe-699cb67220ac.sql
-- =============================================

CREATE OR REPLACE FUNCTION public.accept_help_request(
  _request_id UUID,
  _order_id   TEXT DEFAULT NULL
)
RETURNS TABLE (
  request_id UUID,
  payment_id UUID,
  chat_thread_id UUID,
  is_paid BOOLEAN,
  amount NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_helper UUID := auth.uid();
  v_request public.help_requests%ROWTYPE;
  v_thread_id UUID;
  v_payment_id UUID;
BEGIN
  IF v_helper IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  UPDATE public.help_requests hr
     SET status = 'accepted',
         helper_id = v_helper,
         accepted_at = now()
   WHERE hr.id = _request_id
     AND hr.status = 'open'
     AND hr.requester_id <> v_helper
  RETURNING hr.* INTO v_request;

  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_available'; END IF;

  INSERT INTO public.chat_threads AS ct (request_id) VALUES (v_request.id)
    ON CONFLICT (request_id) DO UPDATE SET request_id = ct.request_id
    RETURNING ct.id INTO v_thread_id;

  IF v_request.is_paid AND v_request.estimated_fare IS NOT NULL AND v_request.estimated_fare > 0 THEN
    INSERT INTO public.payments (request_id, payer_id, amount, status, razorpay_order_id)
    VALUES (v_request.id, v_request.requester_id, v_request.estimated_fare, 'pending',
            COALESCE(_order_id, 'sim_order_' || gen_random_uuid()::text))
    RETURNING id INTO v_payment_id;

    UPDATE public.help_requests SET payment_id = v_payment_id WHERE id = v_request.id;
  END IF;

  INSERT INTO public.notifications (user_id, type, request_id, message)
  VALUES (v_request.requester_id, 'request_accepted'::public.notification_type, v_request.id,
          'Your request "' || v_request.title || '" was accepted.');

  accept_help_request.request_id := v_request.id;
  accept_help_request.payment_id := v_payment_id;
  accept_help_request.chat_thread_id := v_thread_id;
  accept_help_request.is_paid := v_request.is_paid;
  accept_help_request.amount := v_request.estimated_fare;
  RETURN NEXT;
END; $$;

REVOKE ALL ON FUNCTION public.accept_help_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_help_request(uuid, text) TO authenticated;


-- =============================================
-- FILE: 20260720043636_1a0eb91d-b048-482e-ae69-7bb544d5bd77.sql
-- =============================================
CREATE OR REPLACE FUNCTION public.capture_payment(_payment_id uuid, _razorpay_payment_id text DEFAULT NULL)
RETURNS TABLE(payment_id uuid, request_id uuid, amount numeric, commission numeric, helper_credit numeric, helper_id uuid, wallet_balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_request public.help_requests%ROWTYPE;
  v_rate numeric(5,4);
  v_commission numeric(12,2);
  v_credit numeric(12,2);
  v_balance numeric(12,2);
  v_helper uuid;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found'; END IF;

  SELECT * INTO v_request FROM public.help_requests WHERE id = v_payment.request_id FOR UPDATE;

  -- Look up commission rate from pricing_rules by category; fall back to 15%.
  SELECT commission_rate INTO v_rate FROM public.pricing_rules WHERE category = v_request.category;
  v_rate := COALESCE(v_rate, 0.15);

  IF v_payment.status = 'released' THEN
    SELECT w.balance INTO v_balance FROM public.wallets w WHERE w.user_id = v_request.helper_id;
    capture_payment.payment_id := v_payment.id;
    capture_payment.request_id := v_payment.request_id;
    capture_payment.amount := v_payment.amount;
    capture_payment.commission := ROUND(v_payment.amount * v_rate, 2);
    capture_payment.helper_credit := v_payment.amount - ROUND(v_payment.amount * v_rate, 2);
    capture_payment.helper_id := v_request.helper_id;
    capture_payment.wallet_balance := COALESCE(v_balance, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_request.helper_id IS NULL THEN RAISE EXCEPTION 'no_helper_assigned'; END IF;

  v_commission := ROUND(v_payment.amount * v_rate, 2);
  v_credit := v_payment.amount - v_commission;

  UPDATE public.payments
    SET status = 'released',
        razorpay_payment_id = COALESCE(_razorpay_payment_id, razorpay_payment_id),
        updated_at = now()
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;

  UPDATE public.help_requests
    SET final_fare = v_payment.amount, commission_amount = v_commission, updated_at = now()
    WHERE id = v_request.id;

  INSERT INTO public.wallets(user_id, balance)
    VALUES (v_request.helper_id, v_credit)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now()
    RETURNING balance INTO v_balance;

  INSERT INTO public.notifications(user_id, type, request_id, message) VALUES
    (v_request.helper_id,   'request_completed'::public.notification_type, v_request.id, 'Payment released to your wallet: ' || v_credit),
    (v_request.requester_id,'request_completed'::public.notification_type, v_request.id, 'Payment captured. Thank you!');

  capture_payment.payment_id := v_payment.id;
  capture_payment.request_id := v_payment.request_id;
  capture_payment.amount     := v_payment.amount;
  capture_payment.commission := v_commission;
  capture_payment.helper_credit := v_credit;
  capture_payment.helper_id  := v_request.helper_id;
  capture_payment.wallet_balance := v_balance;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_payment(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_payment(uuid, text) TO service_role;

-- =============================================
-- FILE: 20260729044107_02284cd9-5be7-4cdd-8fa4-83153bc16762.sql
-- =============================================
-- ============ ENUMS ============
CREATE TYPE public.booking_status AS ENUM ('requested','confirmed','in_progress','completed','cancelled');

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'booking_requested';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'booking_confirmed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'booking_cancelled';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'booking_completed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'session_reminder';

-- ============ TEACHER PROFILES ============
CREATE TABLE public.teacher_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  headline text,
  bio text,
  experience_years integer NOT NULL DEFAULT 0,
  hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
  availability text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_profiles TO authenticated;
GRANT ALL ON public.teacher_profiles TO service_role;
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher_profiles read published or self" ON public.teacher_profiles
  FOR SELECT TO authenticated USING (is_published = true OR user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "teacher_profiles insert self" ON public.teacher_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "teacher_profiles update self" ON public.teacher_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "teacher_profiles delete self" ON public.teacher_profiles
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ SKILL OFFERINGS ============
CREATE TABLE public.skill_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'other',
  price_per_session numeric(10,2) NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 60,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX skill_offerings_teacher_idx ON public.skill_offerings(teacher_id);
CREATE INDEX skill_offerings_published_idx ON public.skill_offerings(is_published, category);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_offerings TO authenticated;
GRANT ALL ON public.skill_offerings TO service_role;
ALTER TABLE public.skill_offerings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offerings read published or own" ON public.skill_offerings
  FOR SELECT TO authenticated USING (is_published = true OR teacher_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "offerings insert own" ON public.skill_offerings
  FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "offerings update own" ON public.skill_offerings
  FOR UPDATE TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "offerings delete own" ON public.skill_offerings
  FOR DELETE TO authenticated USING (teacher_id = auth.uid());

-- ============ SKILL BOOKINGS ============
CREATE TABLE public.skill_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES public.skill_offerings(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  price numeric(10,2) NOT NULL DEFAULT 0,
  commission_amount numeric(10,2),
  status public.booking_status NOT NULL DEFAULT 'requested',
  notes text,
  payment_id uuid,
  cancelled_by uuid,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX skill_bookings_teacher_idx ON public.skill_bookings(teacher_id, scheduled_at DESC);
CREATE INDEX skill_bookings_learner_idx ON public.skill_bookings(learner_id, scheduled_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.skill_bookings TO authenticated;
GRANT ALL ON public.skill_bookings TO service_role;
ALTER TABLE public.skill_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings read party" ON public.skill_bookings
  FOR SELECT TO authenticated USING (learner_id = auth.uid() OR teacher_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "bookings insert learner" ON public.skill_bookings
  FOR INSERT TO authenticated WITH CHECK (learner_id = auth.uid() AND teacher_id <> auth.uid());
CREATE POLICY "bookings update party" ON public.skill_bookings
  FOR UPDATE TO authenticated
  USING (learner_id = auth.uid() OR teacher_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (learner_id = auth.uid() OR teacher_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_teacher_profiles_updated BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_skill_offerings_updated BEFORE UPDATE ON public.skill_offerings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_skill_bookings_updated BEFORE UPDATE ON public.skill_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ BOOKING PARTY HELPER ============
CREATE OR REPLACE FUNCTION public.is_booking_party(_booking_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.skill_bookings b
    WHERE b.id = _booking_id AND (b.learner_id = _user_id OR b.teacher_id = _user_id)
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_booking_party(uuid, uuid) TO authenticated;

-- ============ SHARED CHAT: allow booking threads ============
ALTER TABLE public.chat_threads ALTER COLUMN request_id DROP NOT NULL;
ALTER TABLE public.chat_threads ADD COLUMN booking_id uuid UNIQUE REFERENCES public.skill_bookings(id) ON DELETE CASCADE;
ALTER TABLE public.chat_threads ADD CONSTRAINT chat_threads_one_parent
  CHECK ((request_id IS NOT NULL AND booking_id IS NULL) OR (request_id IS NULL AND booking_id IS NOT NULL));

DROP POLICY "chat_threads read party" ON public.chat_threads;
DROP POLICY "chat_threads insert party" ON public.chat_threads;
CREATE POLICY "chat_threads read party" ON public.chat_threads
  FOR SELECT TO authenticated USING (
    (request_id IS NOT NULL AND public.is_request_party(request_id, auth.uid()))
    OR (booking_id IS NOT NULL AND public.is_booking_party(booking_id, auth.uid()))
    OR public.is_admin(auth.uid())
  );
CREATE POLICY "chat_threads insert party" ON public.chat_threads
  FOR INSERT TO authenticated WITH CHECK (
    (request_id IS NOT NULL AND public.is_request_party(request_id, auth.uid()))
    OR (booking_id IS NOT NULL AND public.is_booking_party(booking_id, auth.uid()))
  );

-- is_thread_party must understand booking threads too
CREATE OR REPLACE FUNCTION public.is_thread_party(_thread_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = _thread_id
      AND (
        (t.request_id IS NOT NULL AND public.is_request_party(t.request_id, _user_id))
        OR (t.booking_id IS NOT NULL AND public.is_booking_party(t.booking_id, _user_id))
      )
  );
$$;

-- ============ SHARED RATINGS: allow booking ratings ============
ALTER TABLE public.ratings ALTER COLUMN request_id DROP NOT NULL;
ALTER TABLE public.ratings ADD COLUMN booking_id uuid REFERENCES public.skill_bookings(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX ratings_booking_rater_key ON public.ratings(booking_id, rater_id) WHERE booking_id IS NOT NULL;

DROP POLICY "ratings insert party completed" ON public.ratings;
CREATE POLICY "ratings insert party completed" ON public.ratings
  FOR INSERT TO authenticated WITH CHECK (
    rater_id = auth.uid() AND ratee_id <> auth.uid() AND (
      (request_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.help_requests r
        WHERE r.id = ratings.request_id AND r.status = 'completed'
          AND (r.requester_id = auth.uid() OR r.helper_id = auth.uid())
          AND (r.requester_id = ratings.ratee_id OR r.helper_id = ratings.ratee_id)))
      OR
      (booking_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.skill_bookings b
        WHERE b.id = ratings.booking_id AND b.status = 'completed'
          AND (b.learner_id = auth.uid() OR b.teacher_id = auth.uid())
          AND (b.learner_id = ratings.ratee_id OR b.teacher_id = ratings.ratee_id)))
    )
  );

-- ============ SHARED NOTIFICATIONS: booking reference ============
ALTER TABLE public.notifications ADD COLUMN booking_id uuid REFERENCES public.skill_bookings(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.insert_booking_notification(
  _user_id uuid, _type public.notification_type, _booking_id uuid, _message text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_booking_party(_booking_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_booking_party';
  END IF;
  INSERT INTO public.notifications(user_id, type, booking_id, message)
  VALUES (_user_id, _type, _booking_id, _message);
END;
$$;
GRANT EXECUTE ON FUNCTION public.insert_booking_notification(uuid, public.notification_type, uuid, text) TO authenticated;

-- ============ SHARED PAYMENTS: booking payments ============
ALTER TABLE public.payments ALTER COLUMN request_id DROP NOT NULL;
ALTER TABLE public.payments ADD COLUMN booking_id uuid REFERENCES public.skill_bookings(id) ON DELETE CASCADE;
DROP POLICY "payments read party or admin" ON public.payments;
CREATE POLICY "payments read party or admin" ON public.payments
  FOR SELECT TO authenticated USING (
    (request_id IS NOT NULL AND public.is_request_party(request_id, auth.uid()))
    OR (booking_id IS NOT NULL AND public.is_booking_party(booking_id, auth.uid()))
    OR public.is_admin(auth.uid())
  );

-- ============ NEARBY TEACHERS ============
CREATE OR REPLACE FUNCTION public.nearby_teachers(
  _lat double precision, _lng double precision, _radius_m integer DEFAULT 5000
)
RETURNS TABLE(
  teacher_id uuid, name text, profile_photo_url text, headline text, bio text,
  experience_years integer, hourly_rate numeric, availability text,
  distance_m double precision, avg_score numeric, rating_count bigint,
  min_price numeric, offering_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tp.user_id, p.name, p.profile_photo_url, tp.headline, tp.bio,
         tp.experience_years, tp.hourly_rate, tp.availability,
         CASE WHEN p.location IS NULL THEN NULL
              ELSE ST_Distance(p.location, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography) END,
         r.avg_score, COALESCE(r.rating_count, 0),
         o.min_price, COALESCE(o.offering_count, 0)
  FROM public.teacher_profiles tp
  JOIN public.profiles p ON p.id = tp.user_id AND p.is_active
  LEFT JOIN LATERAL (
    SELECT ROUND(AVG(score)::numeric, 2) AS avg_score, COUNT(*) AS rating_count
    FROM public.ratings WHERE ratee_id = tp.user_id
  ) r ON true
  LEFT JOIN LATERAL (
    SELECT MIN(price_per_session) AS min_price, COUNT(*) AS offering_count
    FROM public.skill_offerings WHERE teacher_id = tp.user_id AND is_published
  ) o ON true
  WHERE tp.is_published
    AND (
      _radius_m IS NULL OR p.location IS NULL
      OR ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography, _radius_m)
    );
$$;
GRANT EXECUTE ON FUNCTION public.nearby_teachers(double precision, double precision, integer) TO authenticated;

-- ============ BOOKING PAYMENT CAPTURE (privileged) ============
CREATE OR REPLACE FUNCTION public.capture_booking_payment(_payment_id uuid, _external_payment_id text DEFAULT NULL)
RETURNS TABLE(payment_id uuid, booking_id uuid, amount numeric, commission numeric,
              teacher_credit numeric, teacher_id uuid, wallet_balance numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_payment public.payments%ROWTYPE;
  v_booking public.skill_bookings%ROWTYPE;
  v_rate numeric(5,4) := 0.15;
  v_commission numeric(12,2);
  v_credit numeric(12,2);
  v_balance numeric(12,2);
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found'; END IF;
  IF v_payment.booking_id IS NULL THEN RAISE EXCEPTION 'not_a_booking_payment'; END IF;

  SELECT * INTO v_booking FROM public.skill_bookings b WHERE b.id = v_payment.booking_id FOR UPDATE;

  v_commission := ROUND(v_payment.amount * v_rate, 2);
  v_credit := v_payment.amount - v_commission;

  IF v_payment.status = 'released' THEN
    SELECT w.balance INTO v_balance FROM public.wallets w WHERE w.user_id = v_booking.teacher_id;
    capture_booking_payment.payment_id := v_payment.id;
    capture_booking_payment.booking_id := v_booking.id;
    capture_booking_payment.amount := v_payment.amount;
    capture_booking_payment.commission := v_commission;
    capture_booking_payment.teacher_credit := v_credit;
    capture_booking_payment.teacher_id := v_booking.teacher_id;
    capture_booking_payment.wallet_balance := COALESCE(v_balance, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.payments
    SET status = 'released',
        razorpay_payment_id = COALESCE(_external_payment_id, razorpay_payment_id),
        updated_at = now()
    WHERE id = v_payment.id RETURNING * INTO v_payment;

  UPDATE public.skill_bookings
    SET commission_amount = v_commission, updated_at = now()
    WHERE id = v_booking.id;

  INSERT INTO public.wallets(user_id, balance) VALUES (v_booking.teacher_id, v_credit)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now()
    RETURNING balance INTO v_balance;

  INSERT INTO public.notifications(user_id, type, booking_id, message) VALUES
    (v_booking.teacher_id, 'booking_completed'::public.notification_type, v_booking.id,
     'Session payment released to your wallet: ' || v_credit),
    (v_booking.learner_id, 'booking_completed'::public.notification_type, v_booking.id,
     'Session payment captured. Thank you!');

  capture_booking_payment.payment_id := v_payment.id;
  capture_booking_payment.booking_id := v_booking.id;
  capture_booking_payment.amount := v_payment.amount;
  capture_booking_payment.commission := v_commission;
  capture_booking_payment.teacher_credit := v_credit;
  capture_booking_payment.teacher_id := v_booking.teacher_id;
  capture_booking_payment.wallet_balance := v_balance;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_booking_payment(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_booking_payment(uuid, text) TO service_role;

-- =============================================
-- FILE: 20260729052007_06e6197b-ec32-4dc6-bbdd-b902cb08b0ce.sql
-- =============================================
ALTER TABLE public.teacher_profiles
  ADD COLUMN IF NOT EXISTS availability_slots jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.teacher_profiles.availability_slots IS
  'Array of {day:0-6, start:"HH:MM", end:"HH:MM"} weekly recurring availability slots.';

-- =============================================
-- FILE: 20260729062917_13cb1bf4-c436-45d7-94fe-cd5da2577aa2.sql
-- =============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS formatted_address text,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

DO $$ BEGIN
  CREATE TYPE public.teaching_mode AS ENUM ('online','offline','both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.teacher_profiles
  ADD COLUMN IF NOT EXISTS teaching_mode public.teaching_mode NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS location geography(Point,4326),
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS formatted_address text;

CREATE INDEX IF NOT EXISTS teacher_profiles_location_gix ON public.teacher_profiles USING gist (location);
CREATE INDEX IF NOT EXISTS profiles_location_gix ON public.profiles USING gist (location);

CREATE OR REPLACE FUNCTION public.sync_profile_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    NEW.location_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_location ON public.profiles;
CREATE TRIGGER profiles_sync_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_location();

CREATE OR REPLACE FUNCTION public.sync_teacher_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS teacher_profiles_sync_location ON public.teacher_profiles;
CREATE TRIGGER teacher_profiles_sync_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.teacher_profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_teacher_location();

DROP FUNCTION IF EXISTS public.nearby_teachers(double precision, double precision, integer);

CREATE FUNCTION public.nearby_teachers(_lat double precision, _lng double precision, _radius_m integer)
RETURNS TABLE(
  teacher_id uuid,
  name text,
  profile_photo_url text,
  headline text,
  bio text,
  experience_years integer,
  hourly_rate numeric,
  availability text,
  teaching_mode public.teaching_mode,
  city text,
  formatted_address text,
  latitude double precision,
  longitude double precision,
  distance_m double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography AS g
  )
  SELECT
    tp.user_id,
    p.name,
    p.profile_photo_url,
    tp.headline,
    tp.bio,
    tp.experience_years,
    tp.hourly_rate,
    tp.availability,
    tp.teaching_mode,
    COALESCE(tp.city, p.city),
    COALESCE(tp.formatted_address, p.formatted_address),
    COALESCE(tp.latitude, p.latitude),
    COALESCE(tp.longitude, p.longitude),
    ST_Distance(COALESCE(tp.location, p.location), me.g) AS distance_m
  FROM public.teacher_profiles tp
  JOIN public.profiles p ON p.id = tp.user_id
  CROSS JOIN me
  WHERE tp.is_published = true
    AND p.is_active = true
    AND (
      tp.teaching_mode = 'online'
      OR (
        COALESCE(tp.location, p.location) IS NOT NULL
        AND ST_DWithin(COALESCE(tp.location, p.location), me.g, _radius_m)
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.nearby_teachers(double precision, double precision, integer) TO authenticated;

-- =============================================
-- FILE: 20260729064249_bcc24c59-017a-468e-ad9d-014c8fc92c15.sql
-- =============================================
DROP FUNCTION IF EXISTS public.nearby_open_requests(double precision, double precision, integer, request_category, urgency_level);

CREATE OR REPLACE FUNCTION public.nearby_open_requests(
  _lat double precision,
  _lng double precision,
  _radius_m integer DEFAULT 5000,
  _category request_category DEFAULT NULL::request_category,
  _urgency urgency_level DEFAULT NULL::urgency_level
)
RETURNS TABLE(
  id uuid, requester_id uuid, title text, description text,
  category request_category, urgency urgency_level, is_paid boolean,
  estimated_fare numeric, photo_url text, address_text text,
  latitude double precision, longitude double precision,
  distance_m double precision, created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    r.id, r.requester_id, r.title, r.description, r.category, r.urgency,
    r.is_paid, r.estimated_fare, r.photo_url, r.address_text,
    ST_Y(r.location::geometry) AS latitude,
    ST_X(r.location::geometry) AS longitude,
    ST_Distance(r.location, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography) AS distance_m,
    r.created_at
  FROM public.help_requests r
  WHERE r.status = 'open'
    AND r.location IS NOT NULL
    AND (_category IS NULL OR r.category = _category)
    AND (_urgency  IS NULL OR r.urgency  = _urgency)
    AND ST_DWithin(r.location, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography, _radius_m)
  ORDER BY
    CASE r.urgency WHEN 'emergency' THEN 0 WHEN 'today' THEN 1 ELSE 2 END,
    distance_m ASC;
$function$;

GRANT EXECUTE ON FUNCTION public.nearby_open_requests(double precision, double precision, integer, request_category, urgency_level) TO authenticated, service_role;

-- =============================================
-- FILE: 20260729065819_75db1cb6-fbf7-4ade-9422-fb1a0d0928b7.sql
-- =============================================
DO $$ BEGIN
  CREATE TYPE public.help_request_type AS ENUM ('pickup_delivery','home_assistance','transportation','elder_care','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.help_requests
  ADD COLUMN IF NOT EXISTS request_type public.help_request_type NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS pickup_name text,
  ADD COLUMN IF NOT EXISTS pickup_address text,
  ADD COLUMN IF NOT EXISTS pickup_lat double precision,
  ADD COLUMN IF NOT EXISTS pickup_lng double precision,
  ADD COLUMN IF NOT EXISTS dropoff_name text,
  ADD COLUMN IF NOT EXISTS dropoff_address text,
  ADD COLUMN IF NOT EXISTS dropoff_lat double precision,
  ADD COLUMN IF NOT EXISTS dropoff_lng double precision;

UPDATE public.help_requests SET request_type =
  CASE
    WHEN category = 'grocery' THEN 'pickup_delivery'::public.help_request_type
    WHEN category = 'transportation' THEN 'transportation'::public.help_request_type
    WHEN category = 'elderly_care' THEN 'elder_care'::public.help_request_type
    WHEN category = 'errand' THEN 'home_assistance'::public.help_request_type
    ELSE 'custom'::public.help_request_type
  END
WHERE request_type = 'custom';

-- =============================================
-- FILE: 20260729075101_c96dc9c9-065b-4536-aca0-91174589af0e.sql
-- =============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_image_url text;

CREATE POLICY "profile media readable by authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-media');

CREATE POLICY "users upload own profile media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users update own profile media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users delete own profile media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.profile_stats(_user_id uuid)
RETURNS TABLE (
  helps_completed bigint,
  requests_posted bigint,
  sessions_taught bigint,
  sessions_learned bigint,
  avg_score numeric,
  rating_count bigint,
  member_since timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM help_requests WHERE helper_id = _user_id AND status = 'completed'),
    (SELECT count(*) FROM help_requests WHERE requester_id = _user_id),
    (SELECT count(*) FROM skill_bookings WHERE teacher_id = _user_id AND status = 'completed'),
    (SELECT count(*) FROM skill_bookings WHERE learner_id = _user_id AND status = 'completed'),
    (SELECT round(avg(score)::numeric, 2) FROM ratings WHERE ratee_id = _user_id),
    (SELECT count(*) FROM ratings WHERE ratee_id = _user_id),
    (SELECT created_at FROM profiles WHERE id = _user_id);
$$;

GRANT EXECUTE ON FUNCTION public.profile_stats(uuid) TO authenticated;

-- =============================================
-- FILE: 20260729080408_cc72dbed-3ee2-42e1-a27c-b8751be4a67d.sql
-- =============================================
CREATE TYPE public.verification_kind AS ENUM ('email','phone','government_id','selfie');
CREATE TYPE public.verification_status AS ENUM ('pending','verified','rejected');
CREATE TYPE public.report_reason AS ENUM ('fake_profile','abuse','spam','harassment','scam','unsafe_behaviour','other');
CREATE TYPE public.report_status AS ENUM ('open','reviewing','actioned','dismissed');

CREATE TABLE public.user_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.verification_kind NOT NULL,
  status public.verification_status NOT NULL DEFAULT 'pending',
  document_path text,
  submitted_value text,
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);

GRANT SELECT, INSERT, UPDATE ON public.user_verifications TO authenticated;
GRANT ALL ON public.user_verifications TO service_role;
ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own verifications readable"
  ON public.user_verifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "own verifications insert"
  ON public.user_verifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "own verifications update"
  ON public.user_verifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER user_verifications_updated_at
  BEFORE UPDATE ON public.user_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason public.report_reason NOT NULL,
  details text,
  context_type text,
  context_id uuid,
  status public.report_status NOT NULL DEFAULT 'open',
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_report CHECK (reporter_id <> target_user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.user_reports TO authenticated;
GRANT ALL ON public.user_reports TO service_role;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports readable by reporter or admin"
  ON public.user_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "reports insert by reporter"
  ON public.user_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "reports update by admin"
  ON public.user_reports FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER user_reports_updated_at
  BEFORE UPDATE ON public.user_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX user_reports_target_idx ON public.user_reports (target_user_id);

CREATE TABLE public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)
);

GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own blocks readable"
  ON public.user_blocks FOR SELECT TO authenticated
  USING (blocker_id = auth.uid() OR blocked_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "own blocks insert"
  ON public.user_blocks FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "own blocks delete"
  ON public.user_blocks FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

CREATE OR REPLACE FUNCTION public.user_trust(_user_id uuid)
RETURNS TABLE (
  email_verified boolean,
  phone_verified boolean,
  id_verified boolean,
  selfie_verified boolean,
  is_verified boolean,
  helps_completed bigint,
  sessions_taught bigint,
  avg_score numeric,
  rating_count bigint,
  badges text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_email boolean;
  v_phone boolean;
  v_id boolean;
  v_selfie boolean;
  v_helps bigint;
  v_taught bigint;
  v_avg numeric;
  v_count bigint;
  v_badges text[] := '{}';
BEGIN
  SELECT
    COALESCE(bool_or(kind = 'email' AND status = 'verified'), false),
    COALESCE(bool_or(kind = 'phone' AND status = 'verified'), false),
    COALESCE(bool_or(kind = 'government_id' AND status = 'verified'), false),
    COALESCE(bool_or(kind = 'selfie' AND status = 'verified'), false)
  INTO v_email, v_phone, v_id, v_selfie
  FROM public.user_verifications WHERE user_id = _user_id;

  IF NOT COALESCE(v_phone, false) THEN
    SELECT COALESCE(p.phone_verified, false) INTO v_phone FROM public.profiles p WHERE p.id = _user_id;
  END IF;

  SELECT count(*) INTO v_helps
  FROM public.help_requests WHERE helper_id = _user_id AND status = 'completed';

  SELECT count(*) INTO v_taught
  FROM public.skill_bookings WHERE teacher_id = _user_id AND status = 'completed';

  SELECT round(avg(score)::numeric, 2), count(*) INTO v_avg, v_count
  FROM public.ratings WHERE ratee_id = _user_id;

  IF COALESCE(v_phone,false) OR COALESCE(v_id,false) THEN v_badges := array_append(v_badges, 'verified_user'); END IF;
  IF (COALESCE(v_phone,false) OR COALESCE(v_id,false)) AND COALESCE(v_helps,0) >= 1 THEN v_badges := array_append(v_badges, 'verified_helper'); END IF;
  IF (COALESCE(v_phone,false) OR COALESCE(v_id,false)) AND COALESCE(v_taught,0) >= 1 THEN v_badges := array_append(v_badges, 'verified_teacher'); END IF;
  IF COALESCE(v_helps,0) >= 10 AND COALESCE(v_avg, 0) >= 4.5 THEN v_badges := array_append(v_badges, 'super_helper'); END IF;
  IF COALESCE(v_taught,0) >= 10 AND COALESCE(v_avg, 0) >= 4.5 THEN v_badges := array_append(v_badges, 'top_mentor'); END IF;

  RETURN QUERY SELECT
    COALESCE(v_email, false), COALESCE(v_phone, false), COALESCE(v_id, false), COALESCE(v_selfie, false),
    COALESCE(v_phone, false) OR COALESCE(v_id, false),
    COALESCE(v_helps, 0), COALESCE(v_taught, 0), v_avg, COALESCE(v_count, 0), v_badges;
END;
$fn$;

REVOKE ALL ON FUNCTION public.user_trust(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_trust(uuid) TO authenticated, service_role;

CREATE POLICY "own verification docs insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own verification docs read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-docs'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
  );

CREATE POLICY "own verification docs update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own verification docs delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- trust and safety foundation complete</query>


-- =============================================
-- FILE: 20260729080756_06f71ff1-d3e4-43c2-9cc2-73bd314106ba.sql
-- =============================================
-- Lock the phone column away from ordinary profile reads.
REVOKE SELECT (phone_number) ON public.profiles FROM authenticated, anon;

-- Caller's own phone number.
CREATE OR REPLACE FUNCTION public.my_phone()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phone_number FROM public.profiles WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.my_phone() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_phone() TO authenticated;

-- Counterparty phone, revealed only once both sides are committed.
CREATE OR REPLACE FUNCTION public.counterparty_phone(_other_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _allowed boolean := false;
BEGIN
  IF _me IS NULL OR _other_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF _me = _other_id OR public.is_admin(_me) THEN
    RETURN (SELECT phone_number FROM public.profiles WHERE id = _other_id);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.help_requests r
    WHERE r.helper_id IS NOT NULL
      AND r.status IN ('accepted', 'in_progress', 'completed')
      AND ((r.requester_id = _me AND r.helper_id = _other_id)
        OR (r.helper_id = _me AND r.requester_id = _other_id))
  ) OR EXISTS (
    SELECT 1 FROM public.skill_bookings b
    WHERE b.status IN ('confirmed', 'in_progress', 'completed')
      AND ((b.teacher_id = _me AND b.learner_id = _other_id)
        OR (b.learner_id = _me AND b.teacher_id = _other_id))
  ) INTO _allowed;

  IF NOT _allowed THEN
    RETURN NULL;
  END IF;

  RETURN (SELECT phone_number FROM public.profiles WHERE id = _other_id);
END;
$$;

REVOKE ALL ON FUNCTION public.counterparty_phone(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.counterparty_phone(uuid) TO authenticated;

-- =============================================
-- FILE: 20260729081429_d48cbfb5-9a1d-4c0e-b975-6b4c57a7dbdf.sql
-- =============================================
ALTER TABLE public.teacher_profiles
  ADD COLUMN IF NOT EXISTS meeting_provider text,
  ADD COLUMN IF NOT EXISTS meeting_link text,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.category_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module IN ('help', 'skills')),
  name text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.category_suggestions TO authenticated;
GRANT UPDATE ON public.category_suggestions TO authenticated;
GRANT ALL ON public.category_suggestions TO service_role;

ALTER TABLE public.category_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suggestions read approved or own or admin"
  ON public.category_suggestions FOR SELECT TO authenticated
  USING (status = 'approved' OR suggested_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "suggestions insert own"
  ON public.category_suggestions FOR INSERT TO authenticated
  WITH CHECK (suggested_by = auth.uid());

CREATE POLICY "suggestions admin update"
  ON public.category_suggestions FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER category_suggestions_updated_at
  BEFORE UPDATE ON public.category_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS category_suggestions_module_status_idx
  ON public.category_suggestions (module, status);

-- =============================================
-- FILE: 20260729085159_066d0324-b4a6-4ceb-97d6-d67b117f4fd3.sql
-- =============================================
-- 1. Delivery stage -------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.delivery_stage AS ENUM ('accepted','to_pickup','picked_up','on_the_way','delivered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.help_requests
  ADD COLUMN IF NOT EXISTS delivery_stage public.delivery_stage NOT NULL DEFAULT 'accepted';

-- 2. Live tracking ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.request_tracking (
  request_id uuid PRIMARY KEY REFERENCES public.help_requests(id) ON DELETE CASCADE,
  helper_id uuid NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  heading double precision,
  speed double precision,
  eta_minutes integer,
  distance_meters double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.request_tracking TO authenticated;
GRANT ALL ON public.request_tracking TO service_role;

ALTER TABLE public.request_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read tracking"
ON public.request_tracking FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.help_requests r
    WHERE r.id = request_tracking.request_id
      AND (r.requester_id = auth.uid() OR r.helper_id = auth.uid())
  )
);

CREATE POLICY "Helper can insert tracking"
ON public.request_tracking FOR INSERT TO authenticated
WITH CHECK (
  helper_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.help_requests r
    WHERE r.id = request_tracking.request_id AND r.helper_id = auth.uid()
  )
);

CREATE POLICY "Helper can update tracking"
ON public.request_tracking FOR UPDATE TO authenticated
USING (helper_id = auth.uid())
WITH CHECK (helper_id = auth.uid());

CREATE TRIGGER request_tracking_set_updated_at BEFORE UPDATE ON public.request_tracking
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Platform settings -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings"
ON public.platform_settings FOR SELECT TO anon, authenticated USING (true);

CREATE TRIGGER platform_settings_set_updated_at BEFORE UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_settings (key, value) VALUES
  ('maintenance', '{"enabled": false, "message": ""}'::jsonb),
  ('commission', '{"default_rate": 0.15}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4. Announcements ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active announcements"
ON public.announcements FOR SELECT TO anon, authenticated USING (is_active);

CREATE TRIGGER announcements_set_updated_at BEFORE UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Admin analytics -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  _out jsonb;
BEGIN
  SELECT is_admin INTO _is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(_is_admin, false) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'revenue', (
      SELECT jsonb_build_object(
        'today',   COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('day', now())), 0),
        'week',    COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('week', now())), 0),
        'month',   COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('month', now())), 0),
        'year',    COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('year', now())), 0),
        'all_time',COALESCE(SUM(amount), 0)
      ) FROM public.payments WHERE status IN ('held','released')
    ),
    'commission', (
      SELECT jsonb_build_object(
        'help',   COALESCE((SELECT SUM(commission_amount) FROM public.help_requests), 0),
        'skills', COALESCE((SELECT SUM(commission_amount) FROM public.skill_bookings), 0)
      )
    ),
    'wallets', (
      SELECT jsonb_build_object(
        'balance', COALESCE(SUM(balance), 0),
        'count', COUNT(*)
      ) FROM public.wallets
    ),
    'payouts', (
      SELECT jsonb_build_object(
        'pending_count', COUNT(*) FILTER (WHERE status = 'requested'),
        'pending_amount', COALESCE(SUM(amount) FILTER (WHERE status = 'requested'), 0),
        'paid_amount', COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)
      ) FROM public.payouts
    ),
    'users', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE is_active),
        'new_today', COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now())),
        'new_week', COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')
      ) FROM public.profiles
    ),
    'requests', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'today', COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now())),
        'open', COUNT(*) FILTER (WHERE status = 'open'),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled')
      ) FROM public.help_requests
    ),
    'bookings', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'today', COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now())),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled')
      ) FROM public.skill_bookings
    ),
    'pending', (
      SELECT jsonb_build_object(
        'verifications', (SELECT COUNT(*) FROM public.user_verifications WHERE status = 'pending'),
        'reports', (SELECT COUNT(*) FROM public.user_reports WHERE status IN ('open','reviewing')),
        'categories', (SELECT COUNT(*) FROM public.category_suggestions WHERE status = 'pending')
      )
    ),
    'growth', (
      SELECT COALESCE(jsonb_agg(row_to_json(g) ORDER BY g.day), '[]'::jsonb) FROM (
        SELECT d::date AS day,
          (SELECT COUNT(*) FROM public.profiles p WHERE p.created_at::date = d::date) AS users,
          (SELECT COUNT(*) FROM public.help_requests r WHERE r.created_at::date = d::date) AS requests,
          (SELECT COUNT(*) FROM public.skill_bookings b WHERE b.created_at::date = d::date) AS bookings,
          (SELECT COALESCE(SUM(amount),0) FROM public.payments pm WHERE pm.created_at::date = d::date AND pm.status IN ('held','released')) AS revenue
        FROM generate_series(now()::date - interval '29 days', now()::date, interval '1 day') d
      ) g
    ),
    'top_cities', (
      SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb) FROM (
        SELECT city, COUNT(*) AS users FROM public.profiles
        WHERE city IS NOT NULL AND city <> '' GROUP BY city ORDER BY COUNT(*) DESC LIMIT 8
      ) c
    ),
    'top_help_categories', (
      SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb) FROM (
        SELECT category::text AS name, COUNT(*) AS total FROM public.help_requests
        GROUP BY category ORDER BY COUNT(*) DESC LIMIT 8
      ) c
    ),
    'top_skills', (
      SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb) FROM (
        SELECT o.category AS name, COUNT(b.id) AS total
        FROM public.skill_offerings o
        LEFT JOIN public.skill_bookings b ON b.offering_id = o.id
        GROUP BY o.category ORDER BY COUNT(b.id) DESC LIMIT 8
      ) c
    ),
    'top_teachers', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT b.teacher_id AS user_id, p.name,
               COUNT(*) FILTER (WHERE b.status = 'completed') AS sessions,
               COALESCE(SUM(b.price) FILTER (WHERE b.status = 'completed'), 0) AS earned
        FROM public.skill_bookings b
        JOIN public.profiles p ON p.id = b.teacher_id
        GROUP BY b.teacher_id, p.name
        ORDER BY COUNT(*) FILTER (WHERE b.status = 'completed') DESC LIMIT 8
      ) t
    ),
    'top_helpers', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT r.helper_id AS user_id, p.name,
               COUNT(*) FILTER (WHERE r.status = 'completed') AS tasks,
               COALESCE(SUM(r.final_fare) FILTER (WHERE r.status = 'completed'), 0) AS earned
        FROM public.help_requests r
        JOIN public.profiles p ON p.id = r.helper_id
        WHERE r.helper_id IS NOT NULL
        GROUP BY r.helper_id, p.name
        ORDER BY COUNT(*) FILTER (WHERE r.status = 'completed') DESC LIMIT 8
      ) t
    ),
    'activity', (
      SELECT COALESCE(jsonb_agg(row_to_json(h)), '[]'::jsonb) FROM (
        SELECT EXTRACT(dow FROM created_at)::int AS dow,
               EXTRACT(hour FROM created_at)::int AS hour,
               COUNT(*) AS total
        FROM public.help_requests
        WHERE created_at >= now() - interval '60 days'
        GROUP BY 1, 2
      ) h
    )
  ) INTO _out;

  RETURN _out;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_overview() TO authenticated;

-- 6. Realtime --------------------------------------------------------------
ALTER TABLE public.request_tracking REPLICA IDENTITY FULL;
ALTER TABLE public.help_requests REPLICA IDENTITY FULL;
ALTER TABLE public.skill_bookings REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.request_tracking;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.help_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.skill_bookings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- SEED DEMO USERS INTO AUTH AND PROFILES
-- ============================================================
DO $$
DECLARE
  v_admin_id uuid := 'a0000000-0000-0000-0000-000000000001';
  v_helper_id uuid := 'a0000000-0000-0000-0000-000000000002';
  v_requester_id uuid := 'a0000000-0000-0000-0000-000000000003';
BEGIN
  -- 1. Admin (admin@hoodi.com / admin123)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@hoodi.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_admin_id,
      'authenticated',
      'authenticated',
      'admin@hoodi.com',
      crypt('admin123', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Admin User"}',
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_admin_id, jsonb_build_object('sub', v_admin_id, 'email', 'admin@hoodi.com'),
      'email', v_admin_id, now(), now(), now()
    );
    UPDATE public.profiles SET is_admin = true, name = 'Admin User' WHERE id = v_admin_id;
  END IF;

  -- 2. Helper (helper@hoodi.com / helper123)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'helper@hoodi.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_helper_id,
      'authenticated',
      'authenticated',
      'helper@hoodi.com',
      crypt('helper123', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Ravi Kumar"}',
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_helper_id, jsonb_build_object('sub', v_helper_id, 'email', 'helper@hoodi.com'),
      'email', v_helper_id, now(), now(), now()
    );
    UPDATE public.profiles SET
      name = 'Ravi Kumar',
      phone_verified = true,
      phone_number = '+919876543210',
      bio = 'Experienced local helper & handyman in Indiranagar / MG Road.',
      location = ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography
    WHERE id = v_helper_id;
  END IF;

  -- 3. Requester (requester@hoodi.com / requester123)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'requester@hoodi.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_requester_id,
      'authenticated',
      'authenticated',
      'requester@hoodi.com',
      crypt('requester123', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Priya Sharma"}',
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_requester_id, jsonb_build_object('sub', v_requester_id, 'email', 'requester@hoodi.com'),
      'email', v_requester_id, now(), now(), now()
    );
    UPDATE public.profiles SET
      name = 'Priya Sharma',
      phone_verified = true,
      phone_number = '+919123456789',
      location = ST_SetSRID(ST_MakePoint(77.6000, 12.9750), 4326)::geography
    WHERE id = v_requester_id;
  END IF;
END $$;