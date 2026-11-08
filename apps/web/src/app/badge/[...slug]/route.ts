import { BRAND } from "@kits/schema";

import { badgeSvg } from "@/lib/badge-svg";
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
  return new Response(badgeSvg(BRAND.name, value), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // GitHub's image proxy respects this; counters refresh every few minutes anyway.
      "cache-control": "public, max-age=300, s-maxage=300",
    },
    status: page ? 200 : 404,
  });
}
