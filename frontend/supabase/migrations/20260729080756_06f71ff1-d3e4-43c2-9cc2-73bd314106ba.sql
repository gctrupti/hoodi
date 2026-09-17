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