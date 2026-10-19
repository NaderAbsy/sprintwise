/**
 * Structured data for search engines (schema.org JSON-LD): what the site is
 * called, what it is and who made it, so a search for "Sprintwise" can show it
 * as the site's own result. "<" is escaped so text can never close the tag.
 */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
