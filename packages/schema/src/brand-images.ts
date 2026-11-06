/**
 * Which files count as a brand image, everywhere: the web's detector, profile uploads and the CLI's
 * download. Fetching stays per runtime; the rules (types, size, safe SVG) live here once.
 */

export const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

export const MAX_BRAND_IMAGE_BYTES = 2_000_000;

/**
 * The file extension for an image response, or null if it isn't one. Many servers send favicons as
 * application/octet-stream (or nothing): then the file name decides.
 */
export function imageExtension(contentType: string, url?: string): string | null {
  const type = contentType.split(";")[0]!.trim().toLowerCase();
  if (IMAGE_TYPES[type]) return IMAGE_TYPES[type]!;
  if (type && !/octet-stream|^text\/plain$/.test(type)) return null;
  const ext = url ? new URL(url, "http://x").pathname.split(".").at(-1)?.toLowerCase() : undefined;
  const fromName = ext === "jpeg" ? "jpg" : ext;
  return fromName && Object.values(IMAGE_TYPES).includes(fromName) ? fromName : null;
}

/**
 * An SVG with no way to run code: no scripts, event handlers, javascript: links or foreignObject.
 * An SVG served from a site's own origin runs its scripts, so unsafe ones are never accepted.
 */
export const isSafeSvg = (svg: string) => !/<script|\son\w+\s*=|javascript:|<foreignObject/i.test(svg);
