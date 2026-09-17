
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
