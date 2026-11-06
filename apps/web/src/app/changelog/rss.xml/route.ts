import { BRAND } from "@kits/schema";

import { getChangelog } from "@/server/newsletter";

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** /changelog/rss.xml — the changelog as RSS 2.0. */
export async function GET() {
  const entries = await getChangelog();
  const items = entries
    .map(
      (e, i) => `<item>
  <title>${esc(e.title)}</title>
  <link>${BRAND.siteUrl}/changelog</link>
  <guid isPermaLink="false">${e.date}-${i}</guid>
  <pubDate>${new Date(`${e.date}T12:00:00Z`).toUTCString()}</pubDate>
  <description>${esc(e.items.join(" · "))}</description>
</item>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(BRAND.name)} changelog</title>
<link>${BRAND.siteUrl}/changelog</link>
<description>What's new in ${esc(BRAND.name)}</description>
${items}
</channel></rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
