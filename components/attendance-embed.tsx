"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const ATTENDANCE_URL =
  process.env.NEXT_PUBLIC_BGS_ATTENDANCE_URL ?? "https://a.bgs.mn";

type Tokens = { at: string; rt: string; exp?: number };

export default function AttendanceEmbed() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const iframeReadyRef = useRef(false);
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error) {
        setError(error.message);
        return;
      }
      if (!data.session) {
        setError("Session олдсонгүй. Дахин нэвтэрнэ үү.");
        return;
      }
      setTokens({
        at: data.session.access_token,
        rt: data.session.refresh_token,
        exp: data.session.expires_at,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh: when supabase rotates tokens, postMessage them to the iframe
  useEffect(() => {
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const w = iframeRef.current?.contentWindow;
      // Iframe нь ATTENDANCE_URL руу navigate хийж дуустал (onLoad) contentWindow
      // нь "about:blank" хэвээр байх ба энэ нь parent-тай ижил origin-той байдаг тул
      // targetOrigin=ATTENDANCE_URL-ээр postMessage дуудвал "does not match recipient
      // window's origin" алдаа шидэж, дараагийн listener-үүдийг тасалдуулна.
      if (!w || !session || !iframeReadyRef.current) return;
      try {
        w.postMessage(
          {
            type: "bgs-attendance:refresh-tokens",
            tokens: {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_at: session.expires_at,
            },
          },
          ATTENDANCE_URL,
        );
      } catch (err) {
        console.error("[attendance-embed] postMessage failed:", err);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!tokens) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hash = `at=${encodeURIComponent(tokens.at)}&rt=${encodeURIComponent(tokens.rt)}${tokens.exp ? `&exp=${tokens.exp}` : ""}`;
  const src = `${ATTENDANCE_URL}/?embed=1&platform=web#${hash}`;

  return (
    <iframe
      ref={iframeRef}
      src={src}
      onLoad={() => {
        iframeReadyRef.current = true;
      }}
      className="w-full border-0"
      style={{ height: "calc(100dvh - var(--header-height, 48px) - 1rem)" }}
    />
  );
}
