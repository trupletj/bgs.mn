import type { NextConfig } from "next";

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
};

export default nextConfig;
