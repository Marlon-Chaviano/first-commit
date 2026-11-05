import { BRAND } from "@kits/schema";

import { formatCount } from "@/lib/format";
import { getKitStats } from "@/server/metrics/queries";
import { getKitPage } from "@/server/registry";

/**
 * /badge/<kit>.svg — installs badge for READMEs, black and white like the site.
 * Width comes from a fixed per-character estimate (monospace-like Verdana 11px).
 */
export async function GET(_request: Request, { params }: RouteContext<"/badge/[...slug]">) {
  const slug = (await params).slug.join("/").replace(/\.svg$/, "");
  const found = await getKitPage(slug);
  // Private kits have no public badge (it would reveal that they exist).
  const page = found?.meta.visibility === "public" ? found : null;
  const value = page ? `${formatCount((await getKitStats(slug)).installs)} installs` : "not found";
  return new Response(badge(BRAND.name, value), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // GitHub's image proxy respects this; counters refresh every few minutes anyway.
      "cache-control": "public, max-age=300, s-maxage=300",
    },
    status: page ? 200 : 404,
  });
}

function badge(label: string, value: string): string {
  const width = (text: string) => Math.round(text.length * 6.6 + 12);
  const lw = width(label);
  const vw = width(value);
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + vw}" height="20" role="img" aria-label="${esc(label)}: ${esc(value)}">
<title>${esc(label)}: ${esc(value)}</title>
<rect width="${lw}" height="20" fill="#000"/>
<rect x="${lw}" width="${vw}" height="20" fill="#fff" stroke="#000"/>
<g font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">
<text x="${lw / 2}" y="14" fill="#fff">${esc(label)}</text>
<text x="${lw + vw / 2}" y="14" fill="#000">${esc(value)}</text>
</g>
</svg>`;
}
