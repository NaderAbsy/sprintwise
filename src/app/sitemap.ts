import type { MetadataRoute } from "next";
import { RELEASES } from "@/lib/site";

const SITE = process.env.BETTER_AUTH_URL ?? "https://sprintwise-omega.vercel.app";

/** The public pages, so search engines find them all. Dated by the latest release, when they last changed. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(`${RELEASES[0].date}T00:00:00Z`);
  return ["/", "/demo", "/product", "/guide", "/about", "/changelog", "/privacy", "/terms"].map((path) => ({
    url: `${SITE}${path}`,
    lastModified,
    priority: path === "/" ? 1 : path === "/demo" ? 0.8 : 0.5,
  }));
}
