
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
