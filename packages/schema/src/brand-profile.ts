import { z } from "zod";

/**
 * A brand profile: a company's colors, fonts and UI rules plus its own docs.
 * Applied to any kit (`init --brand acme/web`, `create-first-commit brand acme/web`), so
 * every project for that company starts with the same identity and the agent
 * follows it without being told each time.
 */
const hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Color en hex, p. ej. #0f172a");

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

export const brandProfileSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, "minúsculas, números y guiones"),
  title: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  colors: paletteSchema,
  /** Optional dark-mode palette (same keys). */
  dark: paletteSchema.partial().optional(),
  /** Google Fonts family names or system stacks. */
  fonts: z.object({ sans: z.string().max(80).optional(), heading: z.string().max(80).optional(), mono: z.string().max(80).optional() }).default({}),
  /** Corner radius, e.g. "0.5rem". */
  radius: z.string().regex(/^\d+(\.\d+)?(px|rem)$/).optional(),
  logo: z.url().optional(),
  /** Tone of voice for UI copy. */
  voice: z.string().max(2000).optional(),
  /** UI rules the agent must follow, one per item. */
  rules: z.array(z.string().min(1).max(500)).max(50).default([]),
  /** The company's own docs, copied to docs/brand/<file>. Markdown or text. */
  docs: z
    .record(z.string().regex(/^[\w.-]+\.(md|txt)$/, "solo nombres de archivo .md o .txt"), z.string().max(100_000))
    .default({}),
});
export type BrandProfile = z.infer<typeof brandProfileSchema>;

const LABELS: Record<keyof BrandPalette, string> = {
  primary: "Principal (acciones, enlaces)",
  primaryForeground: "Texto sobre principal",
  background: "Fondo",
  foreground: "Texto",
  secondary: "Secundario",
  accent: "Acento",
  muted: "Apagado (fondos suaves)",
  border: "Bordes",
  success: "Éxito",
  warning: "Aviso",
  danger: "Error / destructivo",
};

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** docs/brand/BRAND.md — for people and agents. */
export function brandMarkdown(p: BrandProfile): string {
  const rows = (palette: Partial<BrandPalette>) =>
    (Object.keys(LABELS) as (keyof BrandPalette)[])
      .filter((k) => palette[k])
      .map((k) => `| ${LABELS[k]} | \`--brand-${kebab(k)}\` | \`${palette[k]}\` |`)
      .join("\n");
  const fonts = Object.entries(p.fonts).filter(([, v]) => v);
  return `# ${p.title}

${p.description ?? ""}

Perfil de marca aplicado por kits. Cámbialo en el perfil, no aquí: \`create-first-commit brand\` vuelve a escribir este archivo.

## Colores

| Uso | Token | Valor |
| --- | --- | --- |
${rows(p.colors)}
${p.dark ? `\n### Modo oscuro\n\n| Uso | Token | Valor |\n| --- | --- | --- |\n${rows(p.dark)}\n` : ""}
${fonts.length ? `## Tipografía\n\n${fonts.map(([k, v]) => `- ${k === "sans" ? "Texto" : k === "heading" ? "Títulos" : "Código"}: **${v}**`).join("\n")}\n` : ""}
${p.radius ? `## Forma\n\n- Radio de las esquinas: \`${p.radius}\` (\`--radius\`)\n` : ""}
${p.logo ? `## Logo\n\n${p.logo}\n` : ""}
${p.voice ? `## Tono de voz\n\n${p.voice}\n` : ""}
${p.rules.length ? `## Reglas de interfaz\n\n${p.rules.map((r) => `- ${r}`).join("\n")}\n` : ""}
${Object.keys(p.docs).length ? `## Documentación de la empresa\n\n${Object.keys(p.docs).map((f) => `- [${f}](./${f})`).join("\n")}\n` : ""}`.replace(/\n{3,}/g, "\n\n");
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
export function brandAgentsSection(p: BrandProfile): string {
  const fonts = Object.entries(p.fonts).filter(([, v]) => v).map(([k, v]) => `${k === "sans" ? "texto" : k === "heading" ? "títulos" : "código"}: ${v}`);
  return `## Marca: ${p.title}

Este proyecto usa la identidad de **${p.title}**. Antes de escribir interfaz, lee \`docs/brand/BRAND.md\`${Object.keys(p.docs).length ? " y la documentación de `docs/brand/`" : ""}.

- Colores: usa solo los tokens de la marca (\`--brand-*\` o, en shadcn/ui, \`bg-primary\`, \`text-foreground\`…). Nunca escribas colores sueltos en hex o con clases de Tailwind como \`bg-blue-500\`.
${fonts.length ? `- Tipografía: ${fonts.join(", ")}. Cárgalas con el sistema de fuentes del framework (en Next.js, \`next/font/google\`).\n` : ""}${p.radius ? `- Esquinas: radio \`${p.radius}\` (\`--radius\`).\n` : ""}${p.voice ? `- Textos: ${p.voice.split("\n")[0]}\n` : ""}${p.rules.map((r) => `- ${r}`).join("\n")}`.trim();
}
