import type { MetadataRoute } from "next";

const SITE = process.env.BETTER_AUTH_URL ?? "https://sprintwise-omega.vercel.app";

/** Search engines may read the public pages; signed-in pages and share links stay out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/projects", "/account", "/share", "/api"] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
