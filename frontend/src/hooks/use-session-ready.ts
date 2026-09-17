import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * True once a Supabase session is actually available in this tab.
 * Authenticated server functions must not be called before this flips,
 * otherwise the bearer attacher sends no Authorization header and the
 * request fails with "Unauthorized: No authorization header provided".
 */
export function useSessionReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (active) setReady(Boolean(session));
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return ready;
}