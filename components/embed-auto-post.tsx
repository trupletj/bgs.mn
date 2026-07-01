"use client";

import { useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { postTokensToParent } from "@/lib/embed";

/**
 * Embed mode-д (`?embed=1`) bgs.mn-ийн идэвхтэй cookie session байгаа бол
 * хэрэглэгчийг login form-руу буцаахгүйгээр parent-руу шууд token postMessage
 * илгээнэ.
 */
export function EmbedAutoPost() {
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        postTokensToParent(data.session);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
