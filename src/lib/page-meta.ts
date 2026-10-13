import type { Metadata } from "next";

/**
 * A public page's title, description and address, for search results and link
 * previews. Each page says what it is, so a shared link to the demo or the guide
 * doesn't read like the home page. The preview image stays the site's own.
 */
export function pageMeta(path: string, title: string, description: string, { absolute = false } = {}): Metadata {
  const shown = absolute ? title : `${title} · Sprintwise`;
  // A page's own openGraph replaces the inherited one, image included, so the site's card is named again.
  const image = { url: "/opengraph-image", width: 1200, height: 630, alt: "Sprintwise: know your stories are ready before the sprint starts" };
  return {
    title: absolute ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { title: shown, description, url: path, siteName: "Sprintwise", type: "website", images: [image] },
    twitter: { card: "summary_large_image", title: shown, description, images: [image] },
  };
}
