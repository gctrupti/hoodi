
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
