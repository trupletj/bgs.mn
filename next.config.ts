import type { NextConfig } from "next";

const embedParentOrigins = (process.env.NEXT_PUBLIC_EMBED_PARENT_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const frameAncestors = ["'self'", ...embedParentOrigins].join(" ");

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
