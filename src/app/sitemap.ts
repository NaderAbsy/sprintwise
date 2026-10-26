import type { MetadataRoute } from "next";
import { RELEASES, SITE_URL } from "@/lib/site";

/**
 * The public pages, so search engines find them all. Only the changelog has a date: it changes with
 * every release, while the other pages don't, and a date that moves without the page changing teaches
 * search engines to ignore it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["/", "/demo", "/demo/report", "/product", "/guide", "/about", "/changelog", "/privacy", "/terms"];
  return pages.map((path) => ({
    url: `${SITE_URL}${path}`,
    ...(path === "/changelog" && { lastModified: new Date(`${RELEASES[0].date}T00:00:00Z`) }),
    priority: path === "/" ? 1 : path === "/demo" ? 0.8 : 0.5,
  }));
}
