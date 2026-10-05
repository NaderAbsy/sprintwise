"use client";
import { Analytics } from "@vercel/analytics/next";
import { redactUrl } from "@/lib/analytics";

/** Cookie-free page-view counts from Vercel, with ids, tokens and search terms removed first. */
export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        const url = redactUrl(event.url);
        return url ? { ...event, url } : null;
      }}
    />
  );
}
