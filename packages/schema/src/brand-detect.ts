import { brandProfileSchema, type BrandPalette, type BrandProfile } from "./brand-profile";

/**
 * Guesses a brand profile from what a company already has: a stylesheet
 * (shadcn/Tailwind variables, design tokens), a brand.json, tokens JSON, a
 * website (theme-color, CSS, name) or a logo's colors. Pure functions, used
 * by the CLI (`brand detect`), the web importer and its server action.
 */

export interface BrandDetection {
  profile: Partial<Omit<BrandProfile, "colors" | "dark">> & { colors: Partial<BrandPalette>; dark?: Partial<BrandPalette> };
  /** Human-readable list of what was found, for the UI ("Color principal: --primary"). */
  found: string[];
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

const firstFamily = (value: string) => {
  const family = value.split(",")[0]!.trim().replace(/^["']|["']$/g, "");
  return family.startsWith("var(") || /^(ui-|system-ui|sans-serif|serif|monospace|-apple-system|inherit)/.test(family) ? undefined : family;
};

export function detectFromCss(css: string): BrandDetection {
  const colors: Partial<BrandPalette> = {};
  const dark: Partial<BrandPalette> = {};
  const fonts: BrandProfile["fonts"] = {};
  const found: string[] = [];
  let radius: string | undefined;
  const allColors = new Map<string, number>();

  for (const { selector, body } of blocks(css)) {
    const isDark = /\.dark\b|prefers-color-scheme:\s*dark|\[data-theme=["']?dark/.test(selector);
    for (const [prop, value] of declarations(body)) {
      const key = VAR_TO_KEY.find(([re]) => re.test(prop))?.[1];
      const color = parseColor(value);
      if (color) allColors.set(color, (allColors.get(color) ?? 0) + 1);
      if (key && color) {
        const target = isDark ? dark : colors;
        if (!target[key]) {
          target[key] = color;
          if (!isDark) found.push(`${key}: ${prop}`);
        }
      }
      if (!isDark) {
        if (/^--(?:font-sans|font-body|brand-font-sans)$/.test(prop) && !fonts.sans) fonts.sans = firstFamily(value);
        if (/^--(?:font-heading|font-display|brand-font-heading)$/.test(prop) && !fonts.heading) fonts.heading = firstFamily(value);
        if (/^--(?:font-mono|brand-font-mono)$/.test(prop) && !fonts.mono) fonts.mono = firstFamily(value);
        if (prop === "font-family" && /(^|,|\s)(body|html|:root)\b/.test(selector) && !fonts.sans) fonts.sans = firstFamily(value);
        if (prop === "--radius" && !radius && /^\d+(\.\d+)?(px|rem)$/.test(value)) radius = value;
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
  }
  // A dark-only site defines its theme under .dark: that is its palette.
  if (!colors.primary && !colors.background && dark.background) {
    Object.assign(colors, dark);
    for (const key of Object.keys(dark)) delete dark[key as keyof BrandPalette];
    found.push("paleta: la del modo oscuro (el sitio solo tiene tema oscuro)");
  }
  // No named primary: the most used saturated color is the best guess, never a status color.
  if (!colors.primary) {
    const status = new Set([colors.danger, colors.success, colors.warning, dark.danger, dark.success, dark.warning].filter(Boolean));
    const vivid = [...allColors]
      .filter(([c]) => !status.has(c) && saturation(c) > 0.35 && luminance(c) > 0.12 && luminance(c) < 0.9)
      .sort((a, b) => b[1] - a[1]);
    if (vivid[0]) {
      colors.primary = vivid[0][0];
      found.push("primary: color más usado");
    }
  }
  if (fonts.sans) found.push(`fuente: ${fonts.sans}`);
  if (radius) found.push(`radio: ${radius}`);
  return {
    profile: { colors, ...(Object.keys(dark).length ? { dark } : {}), fonts: Object.fromEntries(Object.entries(fonts).filter(([, v]) => v)), ...(radius ? { radius } : {}) },
    found,
  };
}

// ── JSON (brand.json or design tokens) ───────────────────────────────────────

export function detectFromJson(json: unknown): BrandDetection {
  const full = brandProfileSchema.safeParse(json);
  if (full.success) return { profile: full.data, found: ["brand.json completo"] };
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

/** Name, theme-color, stylesheets and inline CSS of a page. */
export function readHtml(html: string): { title?: string; themeColor?: string; stylesheets: string[]; inlineCss: string; icon?: string } {
  const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
  const tags = html.match(/<(meta|link)\b[^>]*>/gi) ?? [];
  const meta = (key: string) => tags.find((t) => /^<meta/i.test(t) && new RegExp(`(name|property)\\s*=\\s*["']${key}["']`, "i").test(t));
  const siteName = meta("og:site_name") ?? meta("application-name");
  const title = (siteName && attr(siteName, "content")) ?? html.match(/<title[^>]*>([^<]{1,80})<\/title>/i)?.[1]?.split(/[|\-–—·:]/)[0]?.trim();
  const theme = meta("theme-color");
  const links = tags.filter((t) => /^<link/i.test(t));
  return {
    title: title || undefined,
    themeColor: theme ? (parseColor(attr(theme, "content") ?? "") ?? undefined) : undefined,
    stylesheets: links.filter((t) => /rel\s*=\s*["'][^"']*stylesheet/i.test(t)).map((t) => attr(t, "href")).filter((h): h is string => Boolean(h)),
    inlineCss: (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) ?? []).map((s) => s.replace(/<\/?style[^>]*>/gi, "")).join("\n"),
    icon: links.filter((t) => /rel\s*=\s*["'][^"']*icon/i.test(t)).map((t) => attr(t, "href")).find(Boolean),
  };
}

export function detectFromSite(page: ReturnType<typeof readHtml>, css: string): BrandDetection {
  const fromCss = detectFromCss(`${page.inlineCss}\n${css}`);
  const colors = { ...fromCss.profile.colors };
  const found = [...fromCss.found];
  // theme-color is often the page background (black or white), not the brand: only a vivid one is the primary.
  if (page.themeColor && saturation(page.themeColor) > 0.35) {
    if (!colors.primary || found.includes("primary: color más usado")) {
      colors.primary = page.themeColor;
      const guessed = found.indexOf("primary: color más usado");
      if (guessed !== -1) found.splice(guessed, 1);
      found.unshift("primary: theme-color");
    }
  } else if (page.themeColor && !colors.background) {
    colors.background = page.themeColor;
    found.push("background: theme-color");
  }
  return { profile: { ...fromCss.profile, colors, ...(page.title ? { title: page.title } : {}) }, found: page.title ? [`nombre: ${page.title}`, ...found] : found };
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
  return { profile: { colors: { primary, primaryForeground: readableOn(primary) } }, found: ["primary: color dominante del logo"] };
}

/**
 * A complete, valid profile from a detection: missing required colors get
 * neutral defaults (white background, near-black text). For `brand detect`.
 */
export function completeProfile(d: BrandDetection, name: string, title: string): BrandProfile {
  const colors = { background: "#ffffff", foreground: "#0a0a0a", primary: "#0a0a0a", ...d.profile.colors };
  if (!colors.primaryForeground) colors.primaryForeground = readableOn(colors.primary);
  return brandProfileSchema.parse({ rules: [], docs: {}, fonts: {}, ...d.profile, name, title: d.profile.title ?? title, colors });
}
