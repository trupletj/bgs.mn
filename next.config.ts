import type { NextConfig } from "next";

const embedParentOrigins = (process.env.NEXT_PUBLIC_EMBED_PARENT_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const frameAncestors = ["'self'", ...embedParentOrigins].join(" ");

// NEXT_PUBLIC_SUPABASE_URL-аас тухайн орчны Storage hostname-ийг гаргаж аваад
// remotePatterns-д нэмнэ, ингэснээр self-host IP/domain солигдох бүрд энэ
// файлыг дахин засах шаардлагагүй болно.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseRemotePattern = (() => {
  if (!supabaseUrl) return null;
  try {
    const { protocol, hostname, port } = new URL(supabaseUrl);
    return {
      protocol: protocol.replace(":", "") as "http" | "https",
      hostname,
      port,
      pathname: "/**" as const,
    };
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ljlywyhpxsutvrdeyyla.supabase.co",
        pathname: "/**",
      },
      ...(supabaseRemotePattern ? [supabaseRemotePattern] : []),
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            // CSP frame-ancestors нь mobile shell-аас iframe-аар embed
            // хийхийг зөвшөөрнө. NEXT_PUBLIC_EMBED_PARENT_ORIGINS-аас уншина.
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors};`,
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
