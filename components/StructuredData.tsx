import { buildJsonLd } from '@/lib/seo'

// Server component that emits the site's Organization + WebSite JSON-LD as a
// single <script type="application/ld+json">. The payload is built from static
// SEO constants (lib/seo.buildJsonLd) — no user input is ever interpolated, so
// JSON.stringify alone is sufficient to keep this XSS-safe. Mounted once in the
// root layout's <body>.
export default function StructuredData() {
  return (
    <script
      type="application/ld+json"
      // Static, trusted JSON-LD only — no user input is interpolated.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd()) }}
    />
  )
}
