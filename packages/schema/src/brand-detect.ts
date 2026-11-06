import { brandProfileSchema, SOCIAL_NETWORKS, socialNetworkOf, type BrandPalette, type BrandProfile, type SocialNetwork } from "./brand-profile";

/**
 * Guesses a brand profile from what a company already has: a stylesheet
 * (shadcn/Tailwind variables, design tokens), a brand.json, tokens JSON, a
 * website (theme-color, CSS, name) or a logo's colors. Pure functions, used
 * by the CLI (`brand detect`), the web importer and its server action.
 */

export interface BrandDetection {
  profile: Partial<Omit<BrandProfile, "colors" | "dark">> & { colors: Partial<BrandPalette>; dark?: Partial<BrandPalette> };
  /** Human-readable list of what was found, for the UI ("primary: --primary"). */
  found: string[];
  /** Alternatives, best first, so the person can pick when the guess isn't right. */
  candidates?: BrandCandidates;
  /** False when the primary color is a weak guess: the review should ask for it. */
  primaryConfident?: boolean;
}

export interface Candidate {
  value: string;
  /** Where it came from, for people: "buttons", "theme-color", "the logo"… */
  source: string;
}

export interface BrandCandidates {
  primary: Candidate[];
  logo: Candidate[];
  icon: Candidate[];
  fonts: Candidate[];
}

const emptyCandidates = (): BrandCandidates => ({ primary: [], logo: [], icon: [], fonts: [] });

/** Joins candidate lists, keeping the first occurrence of each value. */
function mergeCandidates(a: BrandCandidates | undefined, b: BrandCandidates | undefined): BrandCandidates | undefined {
  if (!a && !b) return undefined;
  const out = emptyCandidates();
  for (const key of Object.keys(out) as (keyof BrandCandidates)[]) {
    for (const c of [...(a?.[key] ?? []), ...(b?.[key] ?? [])]) if (!out[key].some((x) => x.value === c.value)) out[key].push(c);
  }
  return out;
}

// ── Colors ───────────────────────────────────────────────────────────────────

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
const hex2 = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
const rgbToHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

function hslToHex(h: number, s: number, l: number): string {
  s = clamp(s);
  l = clamp(l);
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/** OKLCH → sRGB (CSS Color 4), gamut-clipped. */
function oklchToHex(L: number, C: number, H: number): string {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const [l, m, s] = [l_ ** 3, m_ ** 3, s_ ** 3];
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
  const [r, g, bl] = lin.map((x) => clamp(gamma(x)) * 255) as [number, number, number];
  return rgbToHex(r, g, bl);
}

const num = (v: string, percentScale = 1) => (v.endsWith("%") ? (parseFloat(v) / 100) * percentScale : parseFloat(v));

/** Any CSS color we can read → "#rrggbb"; null for keywords, var(), gradients… */
export function parseColor(input: string): string | null {
  const v = input.trim().toLowerCase().replace(/\s*!important$/, "");
  let m = v.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    const h = m[1]!;
    if (h.length === 3 || h.length === 4) return `#${h.slice(0, 3).split("").map((c) => c + c).join("")}`;
    if (h.length === 6 || h.length === 8) return `#${h.slice(0, 6)}`;
    return null;
  }
  m = v.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const [r, g, b] = m[1]!.split(/[\s,/]+/).filter(Boolean).map((p) => num(p, 255));
    return [r, g, b].every((x) => Number.isFinite(x)) ? rgbToHex(r!, g!, b!) : null;
  }
  m = v.match(/^hsla?\(([^)]+)\)$/) ?? v.match(/^(-?[\d.]+(?:deg)?\s+[\d.]+%\s+[\d.]+%)(?:\s*\/\s*[\d.]+%?)?$/);
  if (m) {
    const [h, s, l] = m[1]!.split(/[\s,/]+/).filter(Boolean);
    if (!h || !s || !l) return null;
    return hslToHex(parseFloat(h), num(s), num(l));
  }
  m = v.match(/^oklch\(([^)]+)\)$/);
  if (m) {
    const [L, C, H] = m[1]!.split(/[\s/]+/).filter(Boolean);
    if (!L || !C || H === undefined) return null;
    return oklchToHex(num(L), num(C, 0.4), H === "none" ? 0 : parseFloat(H));
  }
  return null;
}

/** 0 (black) … 1 (white). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const saturation = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
};
/** White or near-black text, whichever reads better on `bg`. */
export const readableOn = (bg: string) => (luminance(bg) > 0.55 ? "#0a0a0a" : "#ffffff");

// ── CSS ──────────────────────────────────────────────────────────────────────

const VAR_TO_KEY: [RegExp, keyof BrandPalette][] = [
  [/^--(?:color-|brand-)?primary$/, "primary"],
  [/^--(?:color-|brand-)?primary-foreground$/, "primaryForeground"],
  [/^--(?:color-|brand-)?background$/, "background"],
  [/^--(?:color-|brand-)?foreground$/, "foreground"],
  [/^--(?:color-|brand-)?secondary$/, "secondary"],
  [/^--(?:color-|brand-)?accent$/, "accent"],
  [/^--(?:color-|brand-)?muted$/, "muted"],
  [/^--(?:color-|brand-)?border$/, "border"],
  [/^--(?:color-|brand-)?(?:destructive|danger|error)$/, "danger"],
  [/^--(?:color-|brand-)?success$/, "success"],
  [/^--(?:color-|brand-)?warning$/, "warning"],
];

/** `selector { decls }` blocks, without nesting (enough for :root/.dark/@theme). */
function blocks(css: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) out.push({ selector: m[1]!.trim(), body: m[2]! });
  return out;
}

function declarations(body: string): [string, string][] {
  return body
    .split(";")
    .map((d) => d.split(/:([\s\S]*)/).map((x) => x?.trim()) as [string, string | undefined])
    .filter((d): d is [string, string] => Boolean(d[0] && d[1]));
}

/**
 * A font family as people know it. next/font hashes names ("__Inter_d65c78", "__GeistSans_3a0388"),
 * other tools add "Fallback" twins: both become the real family ("Inter", "Geist Sans").
 */
export function cleanFamily(raw: string): string | undefined {
  let family = raw.trim().replace(/^["']|["']$/g, "");
  if (!family || family.startsWith("var(") || /^(ui-|system-ui|sans-serif|serif|monospace|cursive|-apple-system|blinkmacsystemfont|inherit|initial|segoe ui|roboto|helvetica|arial)/i.test(family) || /emoji|symbol|icons?$|fontawesome|material/i.test(family)) return undefined;
  const hashed = /^__(.+?)(?:_Fallback)?_[0-9a-f]{5,}$/i.exec(family);
  // next/font joins words ("__GeistSans_3a0388" → "Geist Sans"); real names like "ABCFavorit" stay as they are.
  if (hashed) family = hashed[1]!.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  if (/fallback$/i.test(family)) return undefined;
  // "Inter Variable" / "Inter VF" / "sohne-var" are the variable build of the same family.
  return family.replace(/[\s-]+(variable|vf|var)$/i, "").trim() || undefined;
}

const firstFamily = (value: string) => value.split(",").map(cleanFamily).find(Boolean);

/** RGB distance between two #rrggbb colors (0…441). */
function distance(a: string, b: string): number {
  const [r1, g1, b1] = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const [r2, g2, b2] = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return Math.hypot(r1! - r2!, g1! - g2!, b1! - b2!);
}

/** A color that could be a brand color: saturated enough and neither near-white nor near-black. */
export const isBrandish = (hex: string) => saturation(hex) > 0.3 && luminance(hex) > 0.1 && luminance(hex) < 0.9;

/** Colors of social networks' logos: footers are full of them and they are never the site's brand. */
const SOCIAL_COLORS = ["#1877f2", "#1da1f2", "#1d9bf0", "#0a66c2", "#0077b5", "#2867b2", "#ff0000", "#e4405f", "#c13584", "#5865f2", "#25d366", "#ea4c89", "#ff4500", "#3b5998"];
/** Plain usage in the stylesheet counts, but never more than this per color: frequency alone isn't brand evidence. */
const USAGE_CAP = 3;

export interface RankedColor extends Candidate {
  /** Score from strong evidence only (variables, buttons, links, theme-color, the logo). */
  strong: number;
}

/**
 * Scores evidence for the primary color. Where a color is used matters more than how often:
 * a button background or the theme-color says "brand"; a palette dump in a utility CSS says nothing.
 */
export class ColorVotes {
  private votes = new Map<string, { score: number; strong: number; usage: number; sources: Map<string, number>; members: Map<string, number> }>();

  add(color: string, weight: number, source: string): void {
    if (!isBrandish(color)) return;
    const usage = source === "the stylesheet";
    // A social network's color only counts when the site names it as its own (a variable).
    if (!source.includes("variable") && SOCIAL_COLORS.some((c) => distance(c, color) < 14)) return;
    // Shades a few steps apart are the same brand color: vote for the existing group.
    const near = [...this.votes.keys()].find((c) => distance(c, color) < 28) ?? color;
    const entry = this.votes.get(near) ?? { score: 0, strong: 0, usage: 0, sources: new Map(), members: new Map() };
    const counted = usage ? Math.min(weight, USAGE_CAP - entry.usage) : weight;
    if (counted <= 0) return;
    if (usage) entry.usage += counted;
    else entry.strong += counted;
    entry.score += counted;
    entry.sources.set(source, (entry.sources.get(source) ?? 0) + counted);
    // Strong evidence decides which exact shade represents the group.
    entry.members.set(color, (entry.members.get(color) ?? 0) + (usage ? counted / 10 : counted));
    this.votes.set(near, entry);
  }

  ranked(exclude: (string | undefined)[] = []): RankedColor[] {
    const skip = exclude.filter(Boolean) as string[];
    return [...this.votes.values()]
      .map((e) => ({
        value: [...e.members].sort((a, b) => b[1] - a[1])[0]![0],
        source: [...e.sources].sort((a, b) => b[1] - a[1])[0]![0],
        strong: e.strong,
        score: e.score,
      }))
      .filter((c) => !skip.some((x) => distance(x, c.value) < 28))
      .sort((a, b) => b.score - a.score)
      .map(({ value, source, strong }) => ({ value, source, strong }));
  }
}

/** Below this, the best color is a guess: the review asks the person to confirm it. */
export const CONFIDENT_PRIMARY = 8;

/**
 * A variable that names the brand color itself: --brand, --brand-500, --color-brand-bg, --primary-600…
 * Component tokens (--brand-control-checkbox-border) live in a brand namespace but aren't the brand color.
 */
const BRAND_VAR = /^--(?:color-)?(?:brand|primary)(?:-(?:color|primary|main|default|base|bg|background|fill|solid|accent|\d{2,4}))?$/i;

/** Utility palettes (Tailwind's --color-blue-500, --tw-*) list every color a framework offers, not the brand's. */
const PALETTE_VAR = /^--(?:tw-|color-(?:slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d+)?$)/;
const BUTTONISH = /(^|[\s.#\-_,>:[])(btn|button|cta|primary|brand)(?![a-z])|\bbutton\b|\[type=["']?submit/i;
const LINKISH = /(^|[\s,>])a(?![\w-])|(^|[\s.])(link)(?![a-z])/i;

export function detectFromCss(css: string, votes = new ColorVotes()): BrandDetection {
  const colors: Partial<BrandPalette> = {};
  const dark: Partial<BrandPalette> = {};
  const fonts: BrandProfile["fonts"] = {};
  const found: string[] = [];
  const fontVotes = new Map<string, number>();
  const faces = new Set<string>();
  /** Custom properties seen so far, to resolve font-family: var(--font-sans) → var(--font-geist) → "Geist". */
  const vars = new Map<string, string>();
  const family = (value: string, depth = 0): string | undefined => {
    const ref = /^var\(\s*(--[\w-]+)/.exec(value.trim())?.[1];
    if (ref && depth < 4) return vars.has(ref) ? family(vars.get(ref)!, depth + 1) : undefined;
    return firstFamily(value);
  };
  const radii = new Map<string, number>();
  let radius: string | undefined;

  for (const { selector, body } of blocks(css)) {
    const isDark = /\.dark\b|prefers-color-scheme:\s*dark|\[data-theme=["']?dark/.test(selector);
    const isFontFace = /^@font-face/i.test(selector);
    for (const [prop, value] of declarations(body)) {
      const key = VAR_TO_KEY.find(([re]) => re.test(prop))?.[1];
      const color = parseColor(value);
      if (key && color) {
        const target = isDark ? dark : colors;
        if (!target[key]) {
          target[key] = color;
          if (!isDark) found.push(`${key}: ${prop}`);
        }
        if (key === "primary") votes.add(color, isDark ? 7 : 10, `the ${prop} variable`);
        if (key === "accent") votes.add(color, 3, `the ${prop} variable`);
      } else if (color && isDark && BRAND_VAR.test(prop)) {
        // Dark-first sites (Linear…) define their brand in the dark theme.
        votes.add(color, 6, `the ${prop} variable`);
      } else if (color && !isDark && !PALETTE_VAR.test(prop)) {
        if (BRAND_VAR.test(prop)) votes.add(color, 8, `the ${prop} variable`);
        else if (/^--(?:color-)?(?:link|accent)/.test(prop)) votes.add(color, 3, `the ${prop} variable`);
        else if (/^background(-color)?$/.test(prop) && BUTTONISH.test(selector)) votes.add(color, 5, "buttons");
        else if (/^(border-color|outline-color)$/.test(prop) && BUTTONISH.test(selector)) votes.add(color, 2, "buttons");
        else if (prop === "color" && LINKISH.test(selector)) votes.add(color, 3, "links");
        else if (!prop.startsWith("--")) votes.add(color, 0.5, "the stylesheet");
      }
      if (isDark) continue;
      if (prop.startsWith("--") && !vars.has(prop)) vars.set(prop, value);
      if (isFontFace && prop === "font-family") {
        // A family with 40 @font-face rules (one per alphabet) is still one font: count it once.
        const name = cleanFamily(value);
        if (name) faces.add(name);
        continue;
      }
      if (/^--(?:font-(?:family-)?(?:sans|body|text|regular|base|primary|default|main)|brand-font-sans)$/.test(prop) && !fonts.sans) fonts.sans = family(value);
      if (/^--(?:font-(?:family-)?(?:heading|headings|display|title|headline|serif-display)|brand-font-heading)$/.test(prop) && !fonts.heading) fonts.heading = family(value);
      if (/^--(?:font-(?:family-)?(?:mono|monospace|code)|brand-font-mono)$/.test(prop) && !fonts.mono) fonts.mono = family(value);
      if (prop === "font-family") {
        const name = family(value);
        if (name) fontVotes.set(name, (fontVotes.get(name) ?? 0) + 1);
        if (name && /(^|,|\s)(body|html|:root)\b/.test(selector) && !fonts.sans) fonts.sans = name;
        if (name && /(^|,|\s)h[1-3]\b|heading|display|title/.test(selector) && !fonts.heading) fonts.heading = name;
      }
      if (prop === "--radius" && !radius && /^\d+(\.\d+)?(px|rem)$/.test(value)) radius = value;
      if (prop === "border-radius" && BUTTONISH.test(selector) && /^\d+(\.\d+)?(px|rem)$/.test(value) && parseFloat(value) < 40) radii.set(value, (radii.get(value) ?? 0) + 1);
      if (/^background(-color)?$/.test(prop) && /(^|,|\s)(body|html)\b/.test(selector) && color && !colors.background) {
        colors.background = color;
        found.push("background: body");
      }
      if (prop === "color" && /(^|,|\s)(body|html)\b/.test(selector) && color && !colors.foreground) {
        colors.foreground = color;
        found.push("foreground: body");
      }
    }
  }
  // A dark-only site defines its theme under .dark: that is its palette.
  if (!colors.primary && !colors.background && dark.background) {
    Object.assign(colors, dark);
    for (const key of Object.keys(dark)) delete dark[key as keyof BrandPalette];
    found.push("palette: the dark-mode one (the site only has a dark theme)");
  }
  if (!radius && radii.size) {
    radius = [...radii].sort((a, b) => b[1] - a[1])[0]![0];
    found.push("radius: buttons");
  }
  for (const face of faces) fontVotes.set(face, (fontVotes.get(face) ?? 0) + 0.5);
  const isMono = (f: string) => /mono|code|courier|consol/i.test(f);
  const byVotes = [...fontVotes].sort((a, b) => b[1] - a[1]).map(([f]) => f);
  if (fonts.sans && isMono(fonts.sans)) {
    fonts.mono ??= fonts.sans;
    delete fonts.sans;
  }
  fonts.sans ??= byVotes.find((f) => !isMono(f));
  if (!fonts.mono && byVotes.some(isMono)) fonts.mono = byVotes.find(isMono);
  if (fonts.heading === fonts.sans) delete fonts.heading;

  const status = [colors.danger, colors.success, colors.warning];
  const primary = votes.ranked(status);
  if (!colors.primary && primary[0]) {
    colors.primary = primary[0].value;
    found.push(`primary: ${primary[0].source}`);
  }
  // Confident when the site names its primary (--primary) or strong evidence backs the best color.
  const confident = found.some((f) => f.startsWith("primary: --")) || (primary[0]?.strong ?? 0) >= CONFIDENT_PRIMARY;
  if (fonts.sans) found.push(`font: ${fonts.sans}`);
  if (radius) found.push(`radius: ${radius}`);
  const fontList = [...new Set([fonts.sans, fonts.heading, ...[...fontVotes].sort((a, b) => b[1] - a[1]).map(([f]) => f)].filter(Boolean) as string[])];
  return {
    profile: { colors, ...(Object.keys(dark).length ? { dark } : {}), fonts: Object.fromEntries(Object.entries(fonts).filter(([, v]) => v)), ...(radius ? { radius } : {}) },
    found,
    candidates: { ...emptyCandidates(), primary: primary.slice(0, 6).map(({ value, source }) => ({ value, source })), fonts: fontList.slice(0, 6).map((value) => ({ value, source: "the stylesheet" })) },
    primaryConfident: confident,
  };
}

/** Colors drawn in an SVG (fill, stroke, stop-color, style), for the logo's vote. */
export function svgColors(svg: string): string[] {
  return (svg.match(/(?:fill|stroke|stop-color)\s*[:=]\s*["']?\s*(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\))/g) ?? [])
    .map((m) => parseColor(m.replace(/^[^:=]+[:=]\s*["']?\s*/, "")))
    .filter((c): c is string => Boolean(c));
}

// ── JSON (brand.json or design tokens) ───────────────────────────────────────

export function detectFromJson(json: unknown): BrandDetection {
  const full = brandProfileSchema.safeParse(json);
  if (full.success) return { profile: full.data, found: ["complete brand.json"] };
  // Design tokens: walk the tree and match color names (W3C `$value` or Style Dictionary `value`).
  const colors: Partial<BrandPalette> = {};
  const found: string[] = [];
  const walk = (node: unknown, path: string[]) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    const value = record.$value ?? record.value;
    if (typeof value === "string" && parseColor(value)) {
      const name = `--${path.at(-1)}`;
      const key = VAR_TO_KEY.find(([re]) => re.test(name) || re.test(`--${path.slice(-2).join("-")}`))?.[1];
      if (key && !colors[key]) {
        colors[key] = parseColor(value)!;
        found.push(`${key}: ${path.join(".")}`);
      }
      return;
    }
    for (const [k, v] of Object.entries(record)) walk(v, [...path, k]);
  };
  walk(json, []);
  return { profile: { colors }, found };
}

// ── Website ──────────────────────────────────────────────────────────────────

/** An <link rel=icon> candidate: its URL, declared size and type. */
interface IconLink {
  href: string;
  rel: string;
  size: number;
  type?: string;
}

export interface SitePage {
  title?: string;
  description?: string;
  themeColor?: string;
  stylesheets: string[];
  inlineCss: string;
  /** Best favicon: SVG first, then the largest PNG, then anything. Kept for older callers. */
  icon?: string;
  icons: IconLink[];
  appleTouchIcon?: string;
  manifest?: string;
  ogImage?: string;
  /** Best logo guess (first of `logos`). Kept for older callers. */
  logo?: string;
  /** Logo candidates, most reliable first: schema.org data, the header's inline SVG, an <img> marked as the logo. */
  logos: Candidate[];
  /** Font families requested from Google Fonts, in order. */
  googleFonts: string[];
  /** Links to profiles on social networks (JSON-LD sameAs and <a href>). */
  social: string[];
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Base64 for any string, in Node and in browsers. */
function base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export const svgDataUrl = (svg: string) => `data:image/svg+xml;base64,${base64(svg)}`;

/**
 * The logo most sites draw inline: the first <svg> inside the link to the home page in the header
 * (or nav). Scripts, event handlers and foreignObject are removed; sprite references are skipped.
 */
/** The page's header, or its first <nav> when it has no <header>. */
const headerOf = (html: string) => html.match(/<header\b[\s\S]*?<\/header>/i)?.[0] ?? html.match(/<nav\b[\s\S]*?<\/nav>/i)?.[0];

/**
 * What's inside the header's links to the home page: "/", "/home", "/homepage", a language root
 * ("/en", "/es-mx"), the site's origin, or a link labeled as home, logo or brand. That's where the logo is.
 */
function homeLinks(header: string): string[] {
  return [...header.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .filter(([, attrs]) => {
      const href = /href\s*=\s*["']([^"']*)["']/i.exec(attrs!)?.[1] ?? "";
      return /^(?:\.?\/(?:home(?:page)?|index(?:\.html?)?|[a-z]{2}(?:-[a-z]{2})?)?\/?|https?:\/\/[^/]+\/?(?:[a-z]{2}(?:-[a-z]{2})?\/?)?)(?:[#?].*)?$/i.test(href) || /(logo|brand|home)/i.test(attrs!.replace(/href\s*=\s*["'][^"']*["']/i, ""));
    })
    .map(([, , inner]) => inner!);
}

/**
 * Where a page sends the browser right away: `<meta http-equiv="refresh" content="0;url=/es">`
 * (language pickers and "loading" shells). Only immediate redirects, not slow auto-refreshes.
 */
export function metaRefreshUrl(html: string): string | undefined {
  const tag = (html.match(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/i) ?? [])[0];
  const content = tag && /content\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
  const m = content && /^\s*(\d+)\s*[;,]\s*url\s*=\s*['"]?([^'"]+)['"]?\s*$/i.exec(content);
  return m && Number(m[1]) <= 5 ? decode(m[2]!.trim()) : undefined;
}

/** The canonical URL of a page that is only a shell (no header, no nav, almost no content). */
export function shellCanonical(html: string): string | undefined {
  if (html.length > 12_000 || /<(header|nav|main)\b/i.test(html)) return undefined;
  const tag = (html.match(/<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/i) ?? [])[0];
  return tag ? /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] : undefined;
}

export function inlineLogoSvg(html: string): string | undefined {
  const header = headerOf(html);
  if (!header) return undefined;
  const homeLinks_ = homeLinks(header);
  const scope = homeLinks_.find((inner) => /<svg\b/i.test(inner)) ?? (/<svg\b[^>]*(aria-label|class|id)\s*=\s*["'][^"']*logo/i.test(header) ? header.slice(header.search(/<svg\b[^>]*(aria-label|class|id)\s*=\s*["'][^"']*logo/i)) : undefined);
  if (!scope) return undefined;
  const svg = scope.match(/<svg\b[\s\S]*?<\/svg>/i)?.[0];
  if (!svg || svg.length > 150_000 || (/<use\b/i.test(svg) && !/<(path|rect|circle|polygon|ellipse|text)\b/i.test(svg))) return undefined;
  const clean = svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/(href\s*=\s*["'])\s*javascript:[^"']*/gi, "$1");
  return /\sxmlns\s*=/.test(clean) ? clean : clean.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
}

/** Name, description, theme-color, stylesheets, icons, logo, fonts and social links of a page. */
export function readHtml(html: string): SitePage {
  const attr = (tag: string, name: string) => {
    const v = tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
    return v ? decode(v.trim()) : undefined;
  };
  const tags = html.match(/<(meta|link)\b[^>]*>/gi) ?? [];
  const meta = (key: string) => tags.find((t) => /^<meta/i.test(t) && new RegExp(`(name|property)\\s*=\\s*["']${key}["']`, "i").test(t));
  const content = (key: string) => {
    const tag = meta(key);
    return tag ? attr(tag, "content") : undefined;
  };
  const siteName = content("og:site_name") ?? content("application-name");
  const title = siteName ?? html.match(/<title[^>]*>([^<]{1,80})<\/title>/i)?.[1]?.split(/[|\-–—·:]/)[0]?.trim();
  const theme = content("theme-color");
  const links = tags.filter((t) => /^<link/i.test(t));
  const rel = (t: string) => (attr(t, "rel") ?? "").toLowerCase();

  const icons: IconLink[] = links
    .filter((t) => /(^|\s)(icon|shortcut icon)(\s|$)/.test(rel(t)) || rel(t) === "icon")
    .map((t) => ({ href: attr(t, "href") ?? "", rel: rel(t), size: Math.max(0, ...((attr(t, "sizes") ?? "").match(/\d+/g) ?? ["0"]).map(Number)), type: attr(t, "type") }))
    .filter((i) => i.href);
  const isSvg = (i: IconLink) => i.type === "image/svg+xml" || /\.svg(\?|$)/i.test(i.href);
  const bestIcon = icons.find(isSvg) ?? [...icons].sort((a, b) => b.size - a.size)[0];

  // schema.org Organization data: the most reliable logo and social profiles a site publishes.
  const ld: { logo?: string; sameAs: string[] } = { sameAs: [] };
  for (const block of html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? []) {
    try {
      const walk = (node: unknown): void => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (!node || typeof node !== "object") return;
        const n = node as Record<string, unknown>;
        if (!ld.logo && n.logo) ld.logo = typeof n.logo === "string" ? n.logo : typeof (n.logo as { url?: unknown }).url === "string" ? (n.logo as { url: string }).url : undefined;
        if (n.sameAs) ld.sameAs.push(...([] as unknown[]).concat(n.sameAs).filter((u): u is string => typeof u === "string"));
        if (n["@graph"]) walk(n["@graph"]);
      };
      walk(JSON.parse(block.replace(/<\/?script[^>]*>/gi, "")));
    } catch {
      // Broken JSON-LD is common; the rest of the page still counts.
    }
  }
  // <img> whose class, id, alt or file name says "logo" (the header logo, usually the first one).
  // Only in the header: further down, "logo" images are usually customers' and partners' logos.
  const isLogoImg = (t: string) => {
    const src = attr(t, "src") ?? "";
    return /logo/i.test(`${attr(t, "class") ?? ""} ${attr(t, "id") ?? ""} ${attr(t, "alt") ?? ""} ${src.split("/").at(-1) ?? ""}`) && !/\/logos\//i.test(src);
  };
  const headerHtml = headerOf(html) ?? "";
  // An image inside the link to the home page is the logo, whatever its file is called.
  const homeImg = homeLinks(headerHtml).map((inner) => inner.match(/<img\b[^>]*>/i)?.[0]).find(Boolean);
  // Not every site uses <header>: then the top of the page, where the logo always is.
  const bodyTop = html.slice(Math.max(0, html.search(/<body\b/i)), Math.max(0, html.search(/<body\b/i)) + 150_000);
  const logoImg = homeImg ?? (headerHtml.match(/<img\b[^>]*>/gi) ?? []).find(isLogoImg) ?? (bodyTop.match(/<img\b[^>]*>/gi) ?? []).find(isLogoImg);

  const inlineSvg = inlineLogoSvg(html);
  const logos: Candidate[] = [
    ...(ld.logo ? [{ value: ld.logo, source: "the site's schema.org data" }] : []),
    ...(inlineSvg ? [{ value: svgDataUrl(inlineSvg), source: "the header (inline SVG)" }] : []),
    ...(logoImg && attr(logoImg, "src") ? [{ value: attr(logoImg, "src")!, source: "the header image" }] : []),
  ];

  const googleFonts = links
    .map((t) => attr(t, "href") ?? "")
    .filter((h) => /fonts\.googleapis\.com\/css/i.test(h))
    .flatMap((h) => [...h.matchAll(/family=([^&:]+)/gi)].map((m) => decodeURIComponent(m[1]!.replace(/\+/g, " ")).trim()))
    .filter((f, i, all) => f && all.indexOf(f) === i);

  const anchors = (html.match(/<a\b[^>]*href\s*=\s*["']https?:\/\/[^"']+["'][^>]*>/gi) ?? []).map((t) => attr(t, "href")!).filter(Boolean);

  return {
    title: title || undefined,
    description: (content("description") ?? content("og:description"))?.slice(0, 500),
    themeColor: theme ? (parseColor(theme) ?? undefined) : undefined,
    // Stylesheets, including the ones preloaded and swapped in later (a common way to load CSS without blocking).
    stylesheets: links
      .filter((t) => rel(t).split(/\s+/).includes("stylesheet") || (rel(t) === "preload" && /\bas\s*=\s*["']?style/i.test(t)))
      .map((t) => attr(t, "href"))
      .filter((h, i, all): h is string => Boolean(h) && all.indexOf(h) === i),
    inlineCss: (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) ?? []).map((s) => s.replace(/<\/?style[^>]*>/gi, "")).join("\n"),
    icon: bestIcon?.href,
    icons,
    appleTouchIcon: links.find((t) => rel(t).startsWith("apple-touch-icon")) ? attr(links.find((t) => rel(t).startsWith("apple-touch-icon"))!, "href") : undefined,
    manifest: links.find((t) => rel(t) === "manifest") ? attr(links.find((t) => rel(t) === "manifest")!, "href") : undefined,
    ogImage: content("og:image") ?? content("og:image:url") ?? content("twitter:image"),
    logo: logos[0]?.value,
    logos,
    googleFonts,
    social: [...ld.sameAs, ...anchors],
  };
}

/** Absolute http(s) URL, or undefined for data:, javascript: and broken values. */
function absolute(href: string | undefined, base: string | undefined): string | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export interface SiteExtras {
  /** The web app manifest's JSON, if the page links one. */
  manifest?: unknown;
  /** SVG markup of the logo candidates that could be read: their colors vote for the primary. */
  logoSvgs?: string[];
  /** Image URLs checked on the server; when given, any other image URL is dropped as broken. */
  reachable?: Set<string>;
}

const SITE_TITLE_NOISE = /\s*[|\-–—·:]\s*(home|homepage|inicio|official site|welcome)\s*$/i;

export function detectFromSite(page: SitePage, css: string, baseUrl?: string, extras: SiteExtras = {}): BrandDetection {
  const ok = (url: string | undefined) => Boolean(url) && (url!.startsWith("data:") || !extras.reachable || extras.reachable.has(url!));
  const votes = new ColorVotes();
  // A vivid theme-color and the logo's own colors are strong evidence; the stylesheet adds the rest.
  // A very dark or very light theme-color paints the browser bar to match the page: it's the background, not the brand.
  const themeIsBrand = Boolean(page.themeColor && isBrandish(page.themeColor) && luminance(page.themeColor) > 0.18 && luminance(page.themeColor) < 0.85);
  if (themeIsBrand) votes.add(page.themeColor!, 6, "theme-color");
  // Only the chosen logo (the first one) speaks for the brand: other SVGs may be partners' or products'.
  const logoSvg = extras.logoSvgs?.[0];
  for (const color of new Set(logoSvg ? svgColors(logoSvg) : [])) votes.add(color, 8, "the logo");
  const manifest = extras.manifest ? detectFromManifest(extras.manifest, baseUrl) : null;
  if (manifest?.profile.colors.primary) votes.add(manifest.profile.colors.primary, 4, "the web manifest");

  const fromCss = detectFromCss(`${page.inlineCss}\n${css}`, votes);
  const colors = { ...fromCss.profile.colors };
  const found = [...fromCss.found];
  let primaryConfident = fromCss.primaryConfident ?? false;
  // A logo drawn only in black, white or gray (Vercel, Notion…) is a monochrome brand: unless the site
  // names a brand color, its primary is the text color, not some accent from the page.
  const logoColors = logoSvg ? svgColors(logoSvg) : [];
  // Gray/black/white fills: surely monochrome. No fills at all (currentColor): probably, but its color
  // comes from CSS we can't evaluate, so it's only a guess the review asks about.
  const monochromeLogo = Boolean(logoSvg) && !logoColors.some(isBrandish);
  if (monochromeLogo && !primaryConfident) {
    colors.primary = colors.foreground ?? "#0a0a0a";
    const at = found.findIndex((f) => f.startsWith("primary:"));
    if (at !== -1) found.splice(at, 1);
    found.push("primary: the logo is monochrome");
    primaryConfident = logoColors.length > 0;
  }
  if (page.themeColor && !themeIsBrand && !colors.background) {
    colors.background = page.themeColor;
    found.push("background: theme-color");
  }
  if (!colors.background && manifest?.profile.colors.background) colors.background = manifest.profile.colors.background;

  const profile: BrandDetection["profile"] = { ...fromCss.profile, colors };
  const title = (page.title ?? (manifest?.profile.title as string | undefined))?.replace(SITE_TITLE_NOISE, "").trim();
  if (title) {
    profile.title = title;
    found.unshift(`name: ${title}`);
  }
  if (page.description) {
    profile.description = page.description;
    found.push("description: meta description");
  }
  // Fonts from the stylesheet win; Google Fonts links fill in what's missing.
  const [first, second] = page.googleFonts;
  if (first && !fromCss.profile.fonts?.sans) {
    profile.fonts = { ...fromCss.profile.fonts, sans: first, ...(second && !fromCss.profile.fonts?.heading ? { heading: second } : {}) };
    found.push(`fonts: ${page.googleFonts.slice(0, 2).join(", ")} (Google Fonts)`);
  }

  const logos = page.logos
    .map((c) => ({ ...c, value: c.value.startsWith("data:") ? c.value : absolute(c.value, baseUrl) }))
    .filter((c, i, all): c is Candidate => ok(c.value) && all.findIndex((x) => x.value === c.value) === i);
  const isSvg = (i: IconLink) => i.type === "image/svg+xml" || /\.svg(\?|$)/i.test(i.href);
  const icons = [...page.icons]
    .sort((x, y) => Number(isSvg(y)) - Number(isSvg(x)) || y.size - x.size)
    .map((i) => ({ value: absolute(i.href, baseUrl), source: isSvg(i) ? "<link rel=icon> (SVG)" : i.size ? `<link rel=icon> (${i.size}px)` : "<link rel=icon>" }))
    .concat(baseUrl ? [{ value: absolute("/favicon.ico", baseUrl), source: "/favicon.ico" }] : [])
    .filter((c, i, all): c is Candidate => ok(c.value) && all.findIndex((x) => x.value === c.value) === i);

  const assets: NonNullable<BrandProfile["assets"]> = {};
  if (logos[0]) {
    assets.logo = logos[0].value;
    found.push(`logo: ${logos[0].source}`);
  }
  if (icons[0]) {
    assets.icon = icons[0].value;
    found.push(`favicon: ${icons[0].source}`);
  }
  const touch = [absolute(page.appleTouchIcon, baseUrl), manifest?.profile.assets?.appleTouchIcon].find(ok);
  if (touch) {
    assets.appleTouchIcon = touch;
    found.push(touch === manifest?.profile.assets?.appleTouchIcon ? "app icon: web manifest" : "app icon: apple-touch-icon");
  }
  const og = absolute(page.ogImage, baseUrl);
  if (ok(og)) {
    assets.ogImage = og;
    found.push("social image: og:image");
  }
  if (Object.keys(assets).length) profile.assets = assets;

  if (baseUrl) profile.website = new URL(baseUrl).origin;
  const social: Partial<Record<SocialNetwork, string>> = {};
  for (const url of page.social) {
    const network = socialNetworkOf(url);
    // Share buttons and intents aren't the company's profile.
    if (network && !social[network] && !/\/(share|intent|sharer)/i.test(url)) social[network] = url;
  }
  if (Object.keys(social).length) {
    profile.social = social;
    found.push(`social: ${Object.keys(social).map((n) => SOCIAL_NETWORKS[n as SocialNetwork].label).join(", ")}`);
  }

  const fonts = [...page.googleFonts.map((value) => ({ value, source: "Google Fonts" })), ...(fromCss.candidates?.fonts ?? [])].filter(
    (c, i, all) => all.findIndex((x) => x.value === c.value) === i,
  );
  const monochromeApplied = found.includes("primary: the logo is monochrome");
  const primary = [...(monochromeApplied ? [{ value: colors.primary!, source: "the logo (monochrome)" }] : []), ...(fromCss.candidates?.primary ?? [])];
  return { profile, found, candidates: { primary, logo: logos, icon: icons, fonts }, primaryConfident };
}

/** A web app manifest: its name, colors and largest icon. */
export function detectFromManifest(json: unknown, baseUrl?: string): BrandDetection {
  if (!json || typeof json !== "object") return { profile: { colors: {} }, found: [] };
  const m = json as { name?: unknown; short_name?: unknown; theme_color?: unknown; background_color?: unknown; icons?: unknown };
  const colors: Partial<BrandPalette> = {};
  const found: string[] = [];
  const theme = typeof m.theme_color === "string" ? parseColor(m.theme_color) : null;
  if (theme && saturation(theme) > 0.35) {
    colors.primary = theme;
    found.push("primary: manifest theme_color");
  }
  const bg = typeof m.background_color === "string" ? parseColor(m.background_color) : null;
  if (bg) {
    colors.background = bg;
    found.push("background: manifest background_color");
  }
  const icons = (Array.isArray(m.icons) ? m.icons : []) as { src?: unknown; sizes?: unknown; purpose?: unknown }[];
  const largest = icons
    .filter((i) => typeof i.src === "string" && i.purpose !== "monochrome")
    .map((i) => ({ src: i.src as string, size: Math.max(0, ...String(i.sizes ?? "").match(/\d+/g)?.map(Number) ?? [0]) }))
    .sort((a, b) => b.size - a.size)[0];
  const appleTouchIcon = absolute(largest?.src, baseUrl);
  if (appleTouchIcon) found.push(`app icon: manifest (${largest!.size}px)`);
  const title = typeof m.name === "string" ? m.name : typeof m.short_name === "string" ? m.short_name : undefined;
  return { profile: { colors, ...(title ? { title } : {}), ...(appleTouchIcon ? { assets: { appleTouchIcon } } : {}) }, found };
}

/** Joins detections: earlier ones win for each value, assets and social are merged. */
export function mergeDetections(...all: BrandDetection[]): BrandDetection {
  const [head, ...rest] = all;
  const out: BrandDetection = { profile: { ...head!.profile, colors: { ...head!.profile.colors } }, found: [...head!.found], candidates: head!.candidates };
  for (const d of rest) {
    const { colors, assets, social, fonts, ...scalars } = d.profile;
    for (const [k, v] of Object.entries(colors)) if (v && !out.profile.colors[k as keyof BrandPalette]) out.profile.colors[k as keyof BrandPalette] = v;
    for (const [k, v] of Object.entries(scalars)) if (v !== undefined && out.profile[k as keyof typeof scalars] === undefined) Object.assign(out.profile, { [k]: v });
    if (assets) out.profile.assets = { ...assets, ...out.profile.assets };
    if (social) out.profile.social = { ...social, ...out.profile.social };
    if (fonts) out.profile.fonts = { ...fonts, ...out.profile.fonts };
    out.found.push(...d.found.filter((f) => !out.found.includes(f)));
    out.candidates = mergeCandidates(out.candidates, d.candidates);
  }
  return out;
}

// ── Logo (pixels from a canvas) ──────────────────────────────────────────────

/** The logo's dominant vivid color as primary, from RGBA pixel data. */
export function detectFromPixels(data: ArrayLike<number>): BrandDetection {
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) continue; // transparent
    const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
    const key = `${r >> 4},${g >> 4},${b >> 4}`; // 16 levels per channel
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }
  const colors = [...buckets.values()].sort((a, b) => b.n - a.n).map((c) => rgbToHex(c.r / c.n, c.g / c.n, c.b / c.n));
  const primary = colors.find((c) => saturation(c) > 0.3 && luminance(c) > 0.08 && luminance(c) < 0.92) ?? colors[0];
  if (!primary) return { profile: { colors: {} }, found: [] };
  return { profile: { colors: { primary, primaryForeground: readableOn(primary) } }, found: ["primary: the logo's dominant color"] };
}
