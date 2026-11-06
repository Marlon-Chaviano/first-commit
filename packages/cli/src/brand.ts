import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import * as p from "@clack/prompts";
import { BRAND_ASSETS, brandAgentsSection, brandCss, brandLogo, brandMarkdown, brandProfileSchema, brandTokens, BRAND, cliCommand, completeProfile, detectFromCss, upsertBlock, brandStep, imageExtension, isSafeSvg, MAX_BRAND_IMAGE_BYTES, type BrandAssetFiles, type BrandStep, type BrandAssetKind, type BrandProfile, brandSlug } from "@kits/schema";
import pc from "picocolors";

import { api, getToken } from "./api";
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
    if (!existsSync(path)) throw new Error(`Brand profile ${path} doesn't exist`);
    raw = JSON.parse(readFileSync(path, "utf8"));
  } else {
    if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(ref)) throw new Error(`Invalid brand profile: "${ref}" (use owner/name or ./brand.json)`);
    const res = await api("/api/v1/brands/" + ref);
    if (res.status === 404 || res.status === 401) {
      throw new Error(`Brand profile ${ref} not found${(await getToken()) ? "" : `: profiles are private, log in with \`${cliCommand("login")}\``}`);
    }
    if (!res.ok) throw new Error(res.status ? `The registry responded ${res.status} when asked for ${ref}` : res.error!);
    raw = res.data;
  }
  const parsed = brandProfileSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Brand profile ${ref} isn't valid: ${parsed.error.issues[0]?.message}`);
  return parsed.data;
}

/** The brand step as one plan line: what it writes, and the images it brings. */
export function describeBrandStep(step: BrandStep): string {
  return `${step.title}\n    ${pc.dim(`docs/brand, CSS variables, AGENTS.md rules${step.images.length ? ` · ${step.images.join(", ").toLowerCase()}` : ""}`)}`;
}

/** Runs a brand step: images first (so BRAND.md can point at them), then the files. */
export async function runBrandStep(step: BrandStep): Promise<{ written: string[]; skipped: string[] }> {
  if (!step.profile) throw new Error(`The brand profile ${step.ref} wasn't loaded`);
  const images = await downloadBrandAssets(step.profile, step.cwd);
  return { written: [...images.written, ...applyBrand(step.profile, step.cwd, images.files)], skipped: images.skipped };
}


/** The image's bytes and extension, from a data: URL or a download. Throws if it isn't a usable image. */
export async function readBrandImage(source: string): Promise<{ bytes: Buffer; ext: string }> {
  let bytes: Buffer;
  let ext: string | null;
  if (source.startsWith("data:")) {
    const match = /^data:([^;,]+);base64,(.*)$/.exec(source);
    if (!match) throw new Error("invalid data URL");
    ext = imageExtension(match[1]!);
    bytes = Buffer.from(match[2]!, "base64");
  } else {
    const res = await fetch(source, { signal: AbortSignal.timeout(10_000), headers: { "user-agent": `${BRAND.cli}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BRAND_IMAGE_BYTES) throw new Error("too large");
    bytes = Buffer.from(await res.arrayBuffer());
    ext = imageExtension(res.headers.get("content-type") ?? "", source);
  }
  if (!ext) throw new Error("not an image");
  if (bytes.length > MAX_BRAND_IMAGE_BYTES) throw new Error("too large");
  if (ext === "svg" && !isSafeSvg(bytes.toString("utf8"))) throw new Error("SVG with scripts");
  return { bytes, ext };
}

/** Where a framework serves files from its root: public/ (Next, Vite, Astro, Nuxt, Laravel, Rails), static/ (SvelteKit). */
const PUBLIC_DIRS = ["public", "static"];
/** Default favicons a project starts with, by extension: the brand's favicon replaces the one with the same format. */
const FAVICONS: Record<string, string[]> = {
  ico: ["src/app/favicon.ico", "app/favicon.ico", "public/favicon.ico", "static/favicon.ico"],
  svg: ["public/favicon.svg", "static/favicon.svg", "src/app/icon.svg", "app/icon.svg"],
  png: ["static/favicon.png", "public/favicon.png", "src/app/icon.png", "app/icon.png"],
};

/**
 * Downloads the profile's logo, favicon and images into the project (public/brand/, or
 * docs/brand/assets/ without a public folder) and replaces the default favicon. An image that
 * can't be fetched is skipped with a warning: it never fails the install.
 */
export async function downloadBrandAssets(profile: BrandProfile, dir: string): Promise<{ files: BrandAssetFiles; written: string[]; skipped: string[] }> {
  const publicDir = PUBLIC_DIRS.find((d) => existsSync(join(dir, d)));
  const folder = publicDir ? `${publicDir}/brand` : "docs/brand/assets";
  const files: BrandAssetFiles = {};
  const written: string[] = [];
  const skipped: string[] = [];
  const save = (path: string, bytes: Buffer) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), bytes);
    written.push(path);
  };
  await Promise.all(
    (Object.keys(BRAND_ASSETS) as BrandAssetKind[]).map(async (kind) => {
      const source = kind === "logo" ? brandLogo(profile) : profile.assets[kind];
      if (!source) return;
      try {
        const { bytes, ext } = await readBrandImage(source);
        const path = `${folder}/${BRAND_ASSETS[kind].file}.${ext}`;
        save(path, bytes);
        files[kind] = path;
        if (kind === "icon") {
          const replaced = FAVICONS[ext]?.filter((f) => existsSync(join(dir, f))) ?? [];
          for (const f of replaced) save(f, bytes);
          // Next.js app router: app/icon.svg or .png is picked up next to the default favicon.ico.
          const appDir = ["src/app", "app"].find((d) => existsSync(join(dir, d, "layout.tsx")) || existsSync(join(dir, d, "layout.jsx")));
          if (appDir && (ext === "svg" || ext === "png") && !replaced.length) save(`${appDir}/icon.${ext}`, bytes);
        }
      } catch (error) {
        skipped.push(`${BRAND_ASSETS[kind].label}: ${(error as Error).message}`);
      }
    }),
  );
  return { files, written: written.sort(), skipped };
}

/**
 * Writes the brand into a project. Idempotent: managed blocks are replaced,
 * everything else in the user's files is kept. Returns the files it wrote.
 */
export function applyBrand(profile: BrandProfile, dir: string, assets: BrandAssetFiles = {}): string[] {
  const written: string[] = [];
  const write = (path: string, content: string) => {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
    written.push(path);
  };
  write("docs/brand/BRAND.md", brandMarkdown(profile, assets));
  write("docs/brand/tokens.json", brandTokens(profile));
  for (const [file, content] of Object.entries(profile.docs)) write(`docs/brand/${file}`, content.endsWith("\n") ? content : `${content}\n`);

  // CSS variables in the project's global stylesheet, or a standalone file to import.
  const css = brandCss(profile);
  const entry = CSS_ENTRIES.find((f) => existsSync(join(dir, f)));
  if (entry) {
    const existing = readFileSync(join(dir, entry), "utf8");
    const block = `${CSS_START} (${profile.title}). Generated by ${BRAND.cli} brand: change it in the profile */\n${css}${CSS_END}`;
    const start = existing.indexOf(CSS_START);
    const end = existing.indexOf(CSS_END);
    // At the end of the file, so it wins over the theme defined above it.
    const next = start !== -1 && end !== -1 ? existing.slice(0, start) + block + existing.slice(end + CSS_END.length) : `${existing.trimEnd()}\n\n${block}\n`;
    write(entry, next);
  } else {
    write("docs/brand/brand.css", css);
  }

  const agents = join(dir, "AGENTS.md");
  const section = entry ? brandAgentsSection(profile, assets) : `${brandAgentsSection(profile, assets)}\n- The CSS variables are in \`docs/brand/brand.css\`: import them in the global stylesheet (or use \`docs/brand/tokens.json\` if it isn't a web project).`;
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
  if (!css) throw new Error(`No known stylesheets in ${dir} (e.g. src/app/globals.css). Pass the project folder.`);
  const pkg = existsSync(join(dir, "package.json")) ? (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name?: string }) : {};
  const detection = detectFromCss(css);
  const base = (pkg.name ?? dir.split("/").pop() ?? "brand").replace(/^@[^/]+\//, "");
  const name = brandSlug(args.flags.get("name")?.[0] ?? base) || "brand";
  const profile = completeProfile(detection, name, args.flags.get("title")?.[0] ?? base);
  const out = resolve(args.flags.get("out")?.[0] ?? "brand.json");
  writeFileSync(out, `${JSON.stringify(profile, null, 2)}\n`);
  p.note(detection.found.length ? detection.found.join("\n") : "Defaults only: no color variables were found", "Detected");
  p.outro(`${pc.green("Written")} ${out}\nReview it and use it with --brand ${out}, or upload it at ${BRAND.siteUrl}/account/brands`);
}

/** `brand <ref>` — applies (or refreshes) a brand profile in the current project. */
export async function brand(args: ParsedArgs): Promise<void> {
  if (args.positionals[0] === "detect") return detectBrand(args);
  const dir = resolve(args.flags.get("dir")?.[0] ?? ".");
  const lock = await readLock(dir);
  const ref = args.positionals[0] ?? lock?.brand?.ref;
  if (!ref) throw new Error(`Pass the profile: ${cliCommand("brand <owner/name | ./brand.json>")}`);
  p.intro(pc.bgWhite(pc.black(" brand ")));
  const spinner = p.spinner();
  spinner.start(`Loading ${ref}`);
  const profile = await loadBrand(ref);
  spinner.stop(profile.title);
  // The same step `init --brand` runs, as a plan of one.
  const step = brandStep({ ref, profile }, dir);
  if (args.switches.has("dry-run")) {
    p.outro(`${describeBrandStep(step)}\nDry run: nothing was changed.`);
    return;
  }
  const { written, skipped } = await runBrandStep(step);
  if (lock) await writeLock(dir, { ...lock, brand: { ref, title: profile.title }, updatedAt: new Date().toISOString() });
  p.note(written.join("\n"), "Files");
  if (skipped.length) p.log.warn(`Images skipped:\n${skipped.join("\n")}`);
  p.outro(`${pc.green("Brand applied.")} Review the changes with git diff.`);
}
