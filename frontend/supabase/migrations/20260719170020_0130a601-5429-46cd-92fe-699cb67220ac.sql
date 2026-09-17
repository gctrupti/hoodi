
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
