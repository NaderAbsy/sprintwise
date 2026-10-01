import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // CSV uploads are capped at 1 MB; leave headroom for the multipart overhead.
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
