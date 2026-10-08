import type { NextConfig } from "next";

/**
 * Security headers for every response. There's no user-supplied HTML, so the
 * CSP limits what a page may load or contact rather than which scripts run:
 * script-src is left to the defaults because Next's inline bootstrap scripts
 * would need a per-request nonce, which would make every page dynamic.
 * Pages talk only to this site (Atlassian and GitHub are called from the
 * server); images are this site's, inline data, or GitHub avatars.
 */
const CSP = [
  "default-src 'self'",
  // The dev server's hot reload evaluates code; production builds don't.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://avatars.githubusercontent.com",
  "font-src 'self'",
  "media-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
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
