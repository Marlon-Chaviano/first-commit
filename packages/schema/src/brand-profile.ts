import { z } from "zod";

import { BRAND } from "./brand";

/**
 * A brand profile: a company's colors, fonts and UI rules plus its own docs.
 * Applied to any kit (`init --brand acme/web`, `create-first-commit brand acme/web`), so
 * every project for that company starts with the same identity and the agent
 * follows it without being told each time.
 */
const hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Hex color, e.g. #0f172a");

const paletteSchema = z.object({
  primary: hex,
  primaryForeground: hex.optional(),
  background: hex,
  foreground: hex,
  secondary: hex.optional(),
  accent: hex.optional(),
  muted: hex.optional(),
  border: hex.optional(),
  success: hex.optional(),
  warning: hex.optional(),
  danger: hex.optional(),
});
export type BrandPalette = z.infer<typeof paletteSchema>;

/** An image as an http(s) URL, or a small file uploaded in the editor and stored inline as a data: URL. */
const imageRef = z.union([
  z.url({ protocol: /^https?$/ }),
  z
    .string()
    .max(300_000, "Images uploaded to a profile must be under 200 KB")
    .regex(/^data:image\/(png|jpeg|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,[A-Za-z0-9+/=]+$/, "An image URL or an uploaded PNG, JPEG, WebP, GIF, SVG or ICO"),
]);

export const BRAND_ASSETS = {
  logo: { label: "Logo", hint: "For light backgrounds", file: "logo" },
  logoDark: { label: "Logo on dark", hint: "For dark backgrounds", file: "logo-dark" },
  icon: { label: "Favicon", hint: "Square; SVG or PNG", file: "favicon" },
  appleTouchIcon: { label: "App icon", hint: "180×180 PNG", file: "apple-touch-icon" },
  ogImage: { label: "Social image", hint: "1200×630, for link previews", file: "og-image" },
} as const;
export type BrandAssetKind = keyof typeof BRAND_ASSETS;

export const SOCIAL_NETWORKS = {
  x: { label: "X", hosts: ["x.com", "twitter.com"] },
  github: { label: "GitHub", hosts: ["github.com"] },
  linkedin: { label: "LinkedIn", hosts: ["linkedin.com"] },
  instagram: { label: "Instagram", hosts: ["instagram.com"] },
  youtube: { label: "YouTube", hosts: ["youtube.com"] },
  facebook: { label: "Facebook", hosts: ["facebook.com"] },
  tiktok: { label: "TikTok", hosts: ["tiktok.com"] },
  discord: { label: "Discord", hosts: ["discord.gg", "discord.com"] },
} as const;
export type SocialNetwork = keyof typeof SOCIAL_NETWORKS;

/** The network of a profile URL ("https://www.linkedin.com/company/acme" → "linkedin"), or null. */
export function socialNetworkOf(url: string): SocialNetwork | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return (Object.keys(SOCIAL_NETWORKS) as SocialNetwork[]).find((n) => SOCIAL_NETWORKS[n].hosts.some((h) => host === h || host.endsWith(`.${h}`))) ?? null;
  } catch {
    return null;
  }
}

export const brandProfileSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, "lowercase letters, numbers and hyphens"),
  title: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  colors: paletteSchema,
  /** Optional dark-mode palette (same keys). */
  dark: paletteSchema.partial().optional(),
  /** Google Fonts family names or system stacks. */
  fonts: z.object({ sans: z.string().max(80).optional(), heading: z.string().max(80).optional(), mono: z.string().max(80).optional() }).default({}),
  /** Corner radius, e.g. "0.5rem". */
  radius: z.string().regex(/^\d+(\.\d+)?(px|rem)$/).optional(),
  /** Kept for profiles saved before `assets`: the logo's URL. New profiles use assets.logo. */
  logo: z.url().optional(),
  /** Logo, favicon and images, downloaded into each project (public/brand/). */
  assets: z.object(Object.fromEntries(Object.keys(BRAND_ASSETS).map((k) => [k, imageRef.optional()])) as Record<BrandAssetKind, z.ZodOptional<typeof imageRef>>).default({}),
  /** The company's website and social profiles, for footers, metadata and copy. */
  website: z.url({ protocol: /^https?$/ }).optional(),
  social: z.partialRecord(z.enum(Object.keys(SOCIAL_NETWORKS) as [SocialNetwork, ...SocialNetwork[]]), z.url({ protocol: /^https?$/ })).default({}),
  /** Tone of voice for UI copy. */
  voice: z.string().max(2000).optional(),
  /** UI rules the agent must follow, one per item. */
  rules: z.array(z.string().min(1).max(500)).max(50).default([]),
  /** The company's own docs, copied to docs/brand/<file>. Markdown or text. */
  docs: z
    .record(z.string().regex(/^[\w.-]+\.(md|txt)$/, "only .md or .txt file names"), z.string().max(100_000))
    .default({}),
});
export type BrandProfile = z.infer<typeof brandProfileSchema>;

const LABELS: Record<keyof BrandPalette, string> = {
  primary: "Primary (actions, links)",
  primaryForeground: "Text on primary",
  background: "Background",
  foreground: "Text",
  secondary: "Secondary",
  accent: "Accent",
  muted: "Muted (soft backgrounds)",
  border: "Borders",
  success: "Success",
  warning: "Warning",
  danger: "Error / destructive",
};

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Where each asset ended up in the project ("public/brand/logo.svg"), when the CLI downloaded it. */
export type BrandAssetFiles = Partial<Record<BrandAssetKind, string>>;

/** The profile's logo, including profiles saved before `assets` existed. */
export const brandLogo = (p: BrandProfile) => p.assets.logo ?? p.logo;

function assetRows(p: BrandProfile, files: BrandAssetFiles): string {
  return (Object.keys(BRAND_ASSETS) as BrandAssetKind[])
    .map((kind) => {
      const source = kind === "logo" ? brandLogo(p) : p.assets[kind];
      if (!source && !files[kind]) return null;
      const where = files[kind] ? `\`${files[kind]}\`` : source!.startsWith("data:") ? "(uploaded to the profile)" : source;
      return `| ${BRAND_ASSETS[kind].label} | ${where} |`;
    })
    .filter(Boolean)
    .join("\n");
}

/** docs/brand/BRAND.md — for people and agents. */
export function brandMarkdown(p: BrandProfile, files: BrandAssetFiles = {}): string {
  const assets = assetRows(p, files);
  const social = Object.entries(p.social).filter(([, url]) => url);
  const rows = (palette: Partial<BrandPalette>) =>
    (Object.keys(LABELS) as (keyof BrandPalette)[])
      .filter((k) => palette[k])
      .map((k) => `| ${LABELS[k]} | \`--brand-${kebab(k)}\` | \`${palette[k]}\` |`)
      .join("\n");
  const fonts = Object.entries(p.fonts).filter(([, v]) => v);
  return `# ${p.title}

${p.description ?? ""}

Brand profile applied by ${BRAND.name}. Change it in the profile, not here: \`${BRAND.cli} brand\` rewrites this file.

## Colors

| Use | Token | Value |
| --- | --- | --- |
${rows(p.colors)}
${p.dark ? `\n### Dark mode\n\n| Use | Token | Value |\n| --- | --- | --- |\n${rows(p.dark)}\n` : ""}
${fonts.length ? `## Typography\n\n${fonts.map(([k, v]) => `- ${k === "sans" ? "Body" : k === "heading" ? "Headings" : "Code"}: **${v}**`).join("\n")}\n` : ""}
${p.radius ? `## Shape\n\n- Corner radius: \`${p.radius}\` (\`--radius\`)\n` : ""}
${assets ? `## Logo and images\n\n| Asset | File |\n| --- | --- |\n${assets}\n` : ""}
${p.website || social.length ? `## Links\n\n${[p.website && `- Website: ${p.website}`, ...social.map(([n, url]) => `- ${SOCIAL_NETWORKS[n as SocialNetwork].label}: ${url}`)].filter(Boolean).join("\n")}\n` : ""}
${p.voice ? `## Voice and tone\n\n${p.voice}\n` : ""}
${p.rules.length ? `## Interface rules\n\n${p.rules.map((r) => `- ${r}`).join("\n")}\n` : ""}
${Object.keys(p.docs).length ? `## Company documentation\n\n${Object.keys(p.docs).map((f) => `- [${f}](./${f})`).join("\n")}\n` : ""}`.replace(/\n{3,}/g, "\n\n");
}

/** docs/brand/tokens.json — design tokens (W3C draft format) for tools and non-web projects. */
export function brandTokens(p: BrandProfile): string {
  const color = (palette: Partial<BrandPalette>) =>
    Object.fromEntries(Object.entries(palette).filter(([, v]) => v).map(([k, v]) => [kebab(k), { $type: "color", $value: v }]));
  return `${JSON.stringify(
    {
      color: color(p.colors),
      ...(p.dark ? { "color-dark": color(p.dark) } : {}),
      font: Object.fromEntries(Object.entries(p.fonts).filter(([, v]) => v).map(([k, v]) => [k, { $type: "fontFamily", $value: v }])),
      ...(p.radius ? { radius: { $type: "dimension", $value: p.radius } } : {}),
    },
    null,
    2,
  )}\n`;
}

/**
 * CSS variables: `--brand-*` plus the shadcn/ui names (--primary, --background…),
 * so a shadcn project takes the brand with no further changes.
 */
export function brandCss(p: BrandProfile): string {
  const vars = (palette: Partial<BrandPalette>) => {
    const lines = Object.entries(palette)
      .filter(([, v]) => v)
      .map(([k, v]) => `  --brand-${kebab(k)}: ${v};`);
    const alias = (name: string, key: keyof BrandPalette) => (palette[key] ? [`  --${name}: var(--brand-${kebab(key)});`] : []);
    return [
      ...lines,
      ...alias("primary", "primary"),
      ...alias("primary-foreground", "primaryForeground"),
      ...alias("background", "background"),
      ...alias("foreground", "foreground"),
      ...alias("secondary", "secondary"),
      ...alias("accent", "accent"),
      ...alias("muted", "muted"),
      ...alias("border", "border"),
      ...alias("ring", "primary"),
      ...alias("destructive", "danger"),
    ].join("\n");
  };
  const fonts = [
    p.fonts.sans && `  --brand-font-sans: "${p.fonts.sans}", ui-sans-serif, system-ui, sans-serif;`,
    p.fonts.heading && `  --brand-font-heading: "${p.fonts.heading}", ui-sans-serif, system-ui, sans-serif;`,
    p.fonts.mono && `  --brand-font-mono: "${p.fonts.mono}", ui-monospace, monospace;`,
    p.radius && `  --radius: ${p.radius};`,
  ].filter(Boolean);
  return `:root {\n${[vars(p.colors), ...fonts].filter(Boolean).join("\n")}\n}\n${p.dark ? `.dark {\n${vars(p.dark)}\n}\n` : ""}`;
}

/** The brand block of AGENTS.md. */
export function brandAgentsSection(p: BrandProfile, files: BrandAssetFiles = {}): string {
  const local = Object.values(files);
  const fonts = Object.entries(p.fonts).filter(([, v]) => v).map(([k, v]) => `${k === "sans" ? "body" : k === "heading" ? "headings" : "code"}: ${v}`);
  return `## Brand: ${p.title}

This project uses the **${p.title}** identity. Before writing any interface, read \`docs/brand/BRAND.md\`${Object.keys(p.docs).length ? " and the documentation in `docs/brand/`" : ""}.

- Colors: use only the brand tokens (\`--brand-*\` or, in shadcn/ui, \`bg-primary\`, \`text-foreground\`…). Never write loose hex colors or Tailwind classes like \`bg-blue-500\`.
${local.length ? `- Logo and icons: use the files in \`${local[0]!.split("/").slice(0, -1).join("/")}/\` (${local.map((f) => f.split("/").at(-1)).join(", ")}). Never redraw, recolor or approximate the logo with text or an icon.${files.ogImage || files.appleTouchIcon ? " Wire the favicon, apple-touch-icon and social image into the site's metadata." : ""}\n` : ""}${fonts.length ? `- Typography: ${fonts.join(", ")}. Load them with the framework's font system (in Next.js, \`next/font/google\`).\n` : ""}${p.radius ? `- Corners: radius \`${p.radius}\` (\`--radius\`).\n` : ""}${p.voice ? `- Copy: ${p.voice.split("\n")[0]}\n` : ""}${p.rules.map((r) => `- ${r}`).join("\n")}`.trim();
}
