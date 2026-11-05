import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import * as p from "@clack/prompts";
import {
  brandAgentsSection,
  brandCss,
  brandMarkdown,
  brandProfileSchema,
  brandTokens,
  BRAND,
  cliCommand,
  completeProfile,
  detectFromCss,
  upsertBlock,
  type BrandProfile,
} from "@kits/schema";
import pc from "picocolors";

import { getToken } from "./account";
import type { ParsedArgs } from "./args";
import { readLock, writeLock } from "./lockfile";

/** Where each framework keeps its global stylesheet; the first one that exists gets the brand variables. */
const CSS_ENTRIES = [
  "src/app/globals.css",
  "app/globals.css",
  "src/styles/globals.css",
  "src/styles/global.css",
  "src/app.css",
  "src/index.css",
  "app/assets/css/main.css",
  "resources/css/app.css",
  "app/assets/stylesheets/application.css",
  "src/global.css",
];
const CSS_START = "/* kits-brand:start";
const CSS_END = "/* kits-brand:end */";

/** A local file (./brand.json) or a profile from the registry ("acme/web", needs `create-first-commit login` for private ones). */
export async function loadBrand(ref: string): Promise<BrandProfile> {
  const local = ref.startsWith(".") || ref.startsWith("/") || ref.endsWith(".json");
  let raw: unknown;
  if (local) {
    const path = resolve(ref);
    if (!existsSync(path)) throw new Error(`No existe el perfil de marca ${path}`);
    raw = JSON.parse(readFileSync(path, "utf8"));
  } else {
    if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(ref)) throw new Error(`Perfil de marca no válido: "${ref}" (usa dueño/nombre o ./brand.json)`);
    const token = await getToken();
    const res = await fetch(`${process.env.KITS_API_URL ?? BRAND.siteUrl}/api/v1/brands/${ref}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404 || res.status === 401) {
      throw new Error(`No se encontró el perfil de marca ${ref}${token ? "" : `: los perfiles son privados, inicia sesión con \`${cliCommand("login")}\``}`);
    }
    if (!res.ok) throw new Error(`El registro respondió ${res.status} al pedir ${ref}`);
    raw = await res.json();
  }
  const parsed = brandProfileSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`El perfil de marca ${ref} no es válido: ${parsed.error.issues[0]?.message}`);
  return parsed.data;
}

/** What applying the brand writes, for the plan. */
export function describeBrand(profile: BrandProfile): string {
  return `Aplicar la marca ${profile.title}: docs/brand/ (BRAND.md, tokens.json${Object.keys(profile.docs).length ? `, ${Object.keys(profile.docs).length} documento(s)` : ""}), variables CSS y reglas en AGENTS.md`;
}

/**
 * Writes the brand into a project. Idempotent: managed blocks are replaced,
 * everything else in the user's files is kept. Returns the files it wrote.
 */
export function applyBrand(profile: BrandProfile, dir: string): string[] {
  const written: string[] = [];
  const write = (path: string, content: string) => {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
    written.push(path);
  };
  write("docs/brand/BRAND.md", brandMarkdown(profile));
  write("docs/brand/tokens.json", brandTokens(profile));
  for (const [file, content] of Object.entries(profile.docs)) write(`docs/brand/${file}`, content.endsWith("\n") ? content : `${content}\n`);

  // CSS variables in the project's global stylesheet, or a standalone file to import.
  const css = brandCss(profile);
  const entry = CSS_ENTRIES.find((f) => existsSync(join(dir, f)));
  if (entry) {
    const existing = readFileSync(join(dir, entry), "utf8");
    const block = `${CSS_START} (${profile.title}). Generado por ${BRAND.cli} brand: cámbialo en el perfil */\n${css}${CSS_END}`;
    const start = existing.indexOf(CSS_START);
    const end = existing.indexOf(CSS_END);
    // At the end of the file, so it wins over the theme defined above it.
    const next = start !== -1 && end !== -1 ? existing.slice(0, start) + block + existing.slice(end + CSS_END.length) : `${existing.trimEnd()}\n\n${block}\n`;
    write(entry, next);
  } else {
    write("docs/brand/brand.css", css);
  }

  const agents = join(dir, "AGENTS.md");
  const section = entry ? brandAgentsSection(profile) : `${brandAgentsSection(profile)}\n- Las variables CSS están en \`docs/brand/brand.css\`: impórtalas en la hoja de estilos global (o usa \`docs/brand/tokens.json\` si no es un proyecto web).`;
  write("AGENTS.md", upsertBlock("kits-brand", section, "AGENTS.md")(existsSync(agents) ? readFileSync(agents, "utf8") : undefined));
  return written;
}

/**
 * `brand detect [dir]` — reads the project's stylesheets (shadcn/Tailwind
 * variables, fonts, radius) and writes a brand.json to reuse in other projects
 * or upload in the web.
 */
export async function detectBrand(args: ParsedArgs): Promise<void> {
  const dir = resolve(args.positionals[1] ?? ".");
  const css = [...new Set([...CSS_ENTRIES, "tailwind.css", "styles/globals.css", "assets/css/main.css"])]
    .filter((f) => existsSync(join(dir, f)))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
  if (!css) throw new Error(`No hay hojas de estilo conocidas en ${dir} (p. ej. src/app/globals.css). Indica la carpeta del proyecto.`);
  const pkg = existsSync(join(dir, "package.json")) ? (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name?: string }) : {};
  const detection = detectFromCss(css);
  const base = (pkg.name ?? dir.split("/").pop() ?? "marca").replace(/^@[^/]+\//, "");
  const name = (args.flags.get("name")?.[0] ?? base).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "marca";
  const profile = completeProfile(detection, name, args.flags.get("title")?.[0] ?? base);
  const out = resolve(args.flags.get("out")?.[0] ?? "brand.json");
  writeFileSync(out, `${JSON.stringify(profile, null, 2)}\n`);
  p.note(detection.found.length ? detection.found.join("\n") : "Solo valores por defecto: no se encontraron variables de color", "Detectado");
  p.outro(`${pc.green("Escrito")} ${out}\nRevísalo y úsalo con --brand ${out}, o súbelo en ${BRAND.siteUrl}/cuenta/marcas`);
}

/** `brand <ref>` — applies (or refreshes) a brand profile in the current project. */
export async function brand(args: ParsedArgs): Promise<void> {
  if (args.positionals[0] === "detect") return detectBrand(args);
  const dir = resolve(args.flags.get("dir")?.[0] ?? ".");
  const lock = await readLock(dir);
  const ref = args.positionals[0] ?? lock?.brand?.ref;
  if (!ref) throw new Error(`Indica el perfil: ${cliCommand("brand <dueño/nombre | ./brand.json>")}`);
  p.intro(pc.bgCyan(pc.black(" brand ")));
  const spinner = p.spinner();
  spinner.start(`Cargando ${ref}`);
  const profile = await loadBrand(ref);
  spinner.stop(profile.title);
  if (args.switches.has("dry-run")) {
    p.outro(`${describeBrand(profile)}\nDry run: no se ha cambiado nada.`);
    return;
  }
  const files = applyBrand(profile, dir);
  if (lock) await writeLock(dir, { ...lock, brand: { ref, title: profile.title }, updatedAt: new Date().toISOString() });
  p.note(files.join("\n"), "Archivos");
  p.outro(`${pc.green("Marca aplicada.")} Revisa los cambios con git diff.`);
}
