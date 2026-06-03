// Embed bridge — bgs.mn-ийг iframe (web) / React Native WebView (mobile)-аар
// embed хийсэн parent-руу Supabase session token дамжуулах helper.

import type { Session } from "@supabase/supabase-js";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
  }
}

export const EMBED_TOKENS_EVENT = "bgs:auth:tokens";

export type EmbedTokens = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

/** Embed mode-д ажиллаж байгаа эсэх. */
export function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("embed") === "1") return true;
  if (window.parent && window.parent !== window) return true;
  if (window.ReactNativeWebView) return true;
  return false;
}

/** Parent-руу token postMessage илгээх. Web iframe + RN WebView хоёуланг дэмжинэ. */
export function postTokensToParent(session: Session): void {
  if (typeof window === "undefined") return;
  const tokens: EmbedTokens = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  };
  const payload = { type: EMBED_TOKENS_EVENT, tokens };

  if (window.parent && window.parent !== window) {
    window.parent.postMessage(payload, "*");
  }
  if (window.ReactNativeWebView) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    } catch {
      // ignore
    }
  }
}

/** Link href-д embed=1 query-г үргэлжлүүлэх. */
export function withEmbedParam(href: string, embed: boolean): string {
  if (!embed) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}embed=1`;
}
