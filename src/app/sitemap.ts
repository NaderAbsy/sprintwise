import type { MetadataRoute } from "next";
import { RELEASES, SITE_URL } from "@/lib/site";

/** The public pages, so search engines find them all. Dated by the latest release, when they last changed. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(`${RELEASES[0].date}T00:00:00Z`);
  return ["/", "/demo", "/product", "/guide", "/about", "/changelog", "/privacy", "/terms"].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    priority: path === "/" ? 1 : path === "/demo" ? 0.8 : 0.5,
  }));
}
