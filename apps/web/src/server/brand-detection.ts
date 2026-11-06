import "server-only";

import { detectFromSite, imageExtension, isEmptyDetection, isSafeSvg, MAX_BRAND_IMAGE_BYTES, metaRefreshUrl, readHtml, shellCanonical, type BrandDetection } from "@kits/schema";

import { safeFetch, safeFetchText, UnsafeUrlError } from "./safe-fetch";

/** Big sites split CSS into dozens of files: read up to this many in parallel. */
const MAX_STYLESHEETS = 48;

/** Loads an image candidate: null if it's missing, not an image or too big. SVGs come back as text. */
async function probeImage(url: string): Promise<{ url: string; svg?: string } | null> {
  try {
    const res = await safeFetch(url, { maxBytes: MAX_BRAND_IMAGE_BYTES, timeoutMs: 6000, accept: "image/*,*/*" });
    const ext = imageExtension(res.contentType, url);
    if (!ext || res.bytes.length < 16) return null;
    if (ext !== "svg") return { url };
    // An SVG that could run code is never offered, the same rule the CLI and uploads follow.
    const svg = res.bytes.toString("utf8");
    return isSafeSvg(svg) ? { url, svg } : null;
  } catch {
    return null;
  }
}

/** Every stylesheet the page uses, one level of @import included; same-origin ones first (third-party CSS is rarely the brand). */
async function loadStylesheets(hrefs: string[], pageUrl: string): Promise<string> {
  // "Same site" includes subdomains (static.linear.app for linear.app): third-party CSS goes last.
  const site = new URL(pageUrl).hostname.split(".").slice(-2).join(".");
  const own = (u: string) => new URL(u).hostname.endsWith(site);
  const urls = hrefs
    .map((h) => {
      try {
        return new URL(h, pageUrl).toString();
      } catch {
        return null;
      }
    })
    .filter((u): u is string => Boolean(u) && !/fonts\.googleapis\.com|use\.typekit\.net|cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome/i.test(u!))
    .sort((a, b) => Number(own(b)) - Number(own(a)))
    .slice(0, MAX_STYLESHEETS);
  const read = (url: string) =>
    safeFetchText(url, { maxBytes: 1_500_000, accept: "text/css,*/*" })
      .then((r) => ({ url: r.url, text: r.text }))
      .catch(() => null);
  const sheets = (await Promise.all(urls.map(read))).filter((r): r is { url: string; text: string } => Boolean(r));
  const imports = sheets
    .flatMap((sheet) => [...sheet.text.matchAll(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)["']?\s*\)?/gi)].map((m) => new URL(m[1]!, sheet.url).toString()))
    .filter((u) => !urls.includes(u) && !/fonts\.googleapis\.com/i.test(u))
    .slice(0, 4);
  const imported = (await Promise.all(imports.map(read))).filter(Boolean) as { text: string }[];
  return [...sheets, ...imported].map((s) => s.text).join("\n");
}

/**
 * Detects colors, fonts, name, logo, favicons, social image and profiles from a public website.
 * Every image candidate is loaded on the server first, so the review only offers images that work,
 * and the logo's colors vote for the primary color.
 */
export async function detectBrandFromUrl(input: string): Promise<{ ok: true; data: BrandDetection } | { ok: false; error: string }> {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Enter the website address" };
  try {
    let page = await safeFetchText(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`, { maxBytes: 2_000_000 });
    // Language pickers and "loading" shells (<meta refresh>, or only a canonical link) aren't the site: follow them.
    for (let hop = 0; hop < 2; hop++) {
      const next = metaRefreshUrl(page.text) ?? shellCanonical(page.text);
      const url = next ? new URL(next, page.url).toString() : null;
      if (!url || url === page.url) break;
      page = await safeFetchText(url, { maxBytes: 2_000_000 });
    }
    const html = readHtml(page.text);
    const [css, manifest] = await Promise.all([
      loadStylesheets(html.stylesheets, page.url),
      html.manifest
        ? safeFetchText(new URL(html.manifest, page.url).toString(), { maxBytes: 100_000, accept: "application/manifest+json,application/json,*/*" })
            .then((r) => JSON.parse(r.text) as unknown)
            .catch(() => undefined)
        : Promise.resolve(undefined),
    ]);

    const abs = (href?: string) => {
      if (!href || href.startsWith("data:")) return null;
      try {
        return new URL(href, page.url).toString();
      } catch {
        return null;
      }
    };
    const manifestIcons = Array.isArray((manifest as { icons?: unknown } | undefined)?.icons)
      ? ((manifest as { icons: { src?: unknown }[] }).icons.map((i) => (typeof i.src === "string" ? abs(i.src) : null)) as (string | null)[])
      : [];
    const candidates = [
      ...html.logos.map((l) => abs(l.value)),
      ...html.icons.map((i) => abs(i.href)),
      abs("/favicon.ico"),
      abs(html.appleTouchIcon),
      abs(html.ogImage),
      ...manifestIcons,
    ].filter((u, i, all): u is string => Boolean(u) && all.indexOf(u) === i).slice(0, 16);
    const probes = (await Promise.all(candidates.map(probeImage))).filter((p): p is { url: string; svg?: string } => Boolean(p));

    // SVG markup of the logo candidates, in the same order (most reliable first): the first one votes for the colors.
    const logoSvgs = html.logos
      .map((l) => (l.value.startsWith("data:image/svg+xml;base64,") ? Buffer.from(l.value.split(",")[1]!, "base64").toString("utf8") : probes.find((p) => p.url === abs(l.value))?.svg))
      .filter((svg): svg is string => Boolean(svg));

    const detection = detectFromSite(html, css, page.url, { manifest, logoSvgs, reachable: new Set(probes.map((p) => p.url)) });
    if (isEmptyDetection(detection)) {
      return { ok: false, error: "Nothing found on that website. Try uploading its logo or a stylesheet." };
    }
    return { ok: true, data: detection };
  } catch (error) {
    if (error instanceof UnsafeUrlError) return { ok: false, error: error.message };
    return { ok: false, error: `Couldn't read the website: ${(error as Error).message}` };
  }
}
