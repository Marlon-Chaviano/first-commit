import { BRAND } from "@kits/schema";

import { badgeSvg } from "@/lib/badge-svg";

/**
 * /badge/started.svg — the "Started with first-commit" badge every new project's README gets
 * (see readmeBadge in packages/schema). The link carries the kit; the image is the same for all,
 * so it caches for good.
 */
export function GET() {
  return new Response(badgeSvg("started with", BRAND.name), {
    headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=86400, s-maxage=31536000, immutable" },
  });
}
