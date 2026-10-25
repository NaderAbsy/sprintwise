import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Search engines may read the public pages; signed-in pages and share links stay out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/projects", "/account", "/share", "/api"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
