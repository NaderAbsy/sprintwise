import type { NextConfig } from "next";

/**
 * Security headers for every response. There's no user-supplied HTML, so the
 * CSP focuses on framing, plugins, base URLs and where forms may post
 * (GitHub, for sign-in). script-src is left to the defaults because Next's
 * inline bootstrap scripts would need a per-request nonce.
 */
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self' https://github.com",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Imports send only the ticked stories (up to 500); Vercel accepts request bodies up to 4.5 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
