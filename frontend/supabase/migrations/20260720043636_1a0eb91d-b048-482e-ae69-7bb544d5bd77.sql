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