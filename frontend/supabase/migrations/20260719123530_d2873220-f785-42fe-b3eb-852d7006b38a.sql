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