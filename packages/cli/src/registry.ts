import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import {
  BRAND,
  catalogSchema,
  expandKit,
  resolveExtends,
  splitKitRef,
  type LoadedRawKit,
  parseKit,
  REGISTRY_RAW_BASE,
  REGISTRY_SOURCE,
  type Catalog,
  type Kit,
  type RegistryEntry,
} from "@kits/schema";
import { downloadTemplate } from "giget";

import { hashKitDir, unpackArchive, verifyIntegrity, type IntegrityMap } from "@kits/schema/node";

import { getToken } from "./account";

/** Where official kits live. Override with KITS_REGISTRY (a local path or gh:owner/repo/path). */
export const DEFAULT_REGISTRY = REGISTRY_SOURCE;
const DEFAULT_RAW_BASE = REGISTRY_RAW_BASE;

export interface LoadedKit {
  kit: Kit;
  /** Local directory with kit.json and the kit's files. */
  dir: string;
  /** How the user referred to the kit (used in generated commands). */
  ref: string;
}

function registry(): string {
  return process.env.KITS_REGISTRY ?? DEFAULT_REGISTRY;
}

function isLocalPath(ref: string): boolean {
  return ref.startsWith(".") || isAbsolute(ref);
}

/**
 * Kit references (all accept @version except local paths):
 *   mobile-expo[@1.2.0]           official kit from the registry
 *   owner/repo[/path][@v1.0.0]    community kit on GitHub (version = git tag)
 *   ./path/to/kit                 local kit (handy while authoring one)
 */
export async function loadKit(ref: string): Promise<LoadedKit> {
  const top = await loadRawKit(ref);
  // Parents of `extends` are fetched the same way, so they can be official, community or local.
  const merged = await resolveExtends(top, (parentRef) => loadRawKit(parentRef, top.dir), resolve);
  // Community kits use the official library catalog too.
  const kit = expandKit(parseKit(merged), await loadCatalog());
  return { kit, dir: top.dir, ref };
}

/** Downloads (or reads) one kit.json without resolving `extends`. Local refs are relative to `from`. */
async function loadRawKit(ref: string, from = process.cwd()): Promise<LoadedRawKit> {
  const { base: name, version } = splitKitRef(ref);
  let dir: string;
  if (isLocalPath(name)) {
    dir = resolve(from, name);
  } else {
    const reg = registry();
    const official = !name.includes("/");
    if (official && isLocalPath(reg)) {
      dir = resolve(reg, "kits", name);
    } else {
      // Published community kits ("ana/landing"): files at the published commit, checked by hash.
      const published = official ? null : await lookupPublished(name, version);
      // Official versions are tagged "<kit>@<version>"; unpublished GitHub refs take any git ref.
      const tag = version ? `#${official ? `${name}@${version}` : version}` : "";
      const source = published
        ? `gh:${published.repo}${published.path ? `/${published.path}` : ""}#${published.commitSha}`
        : official
          ? `${reg}/kits/${name}${tag}`
          : `gh:${name}${tag}`;
      dir = await mkdtemp(join(tmpdir(), "kits-"));
      try {
        // Private (org) kits come from the registry itself, with the user's token.
        if (published?.archive) unpackArchive(await downloadArchive(name, published.version), dir);
        else await downloadTemplate(source, { dir, force: true });
      } catch (error) {
        // "acme/kit" that the registry didn't return may be a private kit we have no access to.
        const hint = !published && !official ? `. Si es un kit privado de tu organización, inicia sesión con \`${BRAND.cli} login\`` : "";
        throw new Error(`No se pudo descargar el kit "${ref}" (${published?.archive ? "registro privado" : source}): ${(error as Error).message}${hint}`);
      }
      if (published && hashKitDir(dir) !== published.integrity) {
        throw new Error(`El kit ${name}@${published.version} descargado no coincide con el publicado (integridad). No se ha ejecutado nada.`);
      }
    }
  }

  const manifest = join(dir, "kit.json");
  if (!existsSync(manifest)) throw new Error(`Kit "${ref}" no encontrado (no hay kit.json en ${dir})`);
  const raw = JSON.parse(await readFile(manifest, "utf8")) as Record<string, unknown>;
  // Downloaded official kits must match the hash published for their version.
  // A local registry is the author's working copy, so it isn't checked.
  if (!isLocalPath(name) && !name.includes("/") && !isLocalPath(registry())) {
    verifyIntegrity(dir, name, String(raw.version), (await readRegistryFile("integrity.json")) as IntegrityMap);
  }
  // A local registry only has the current version; a tag that doesn't match is caught here too.
  if (version && version.replace(/^v/, "") !== String(raw.version)) {
    throw new Error(`Se pidió ${name}@${version} pero el kit disponible es la versión ${String(raw.version)}`);
  }
  return { raw, dir };
}

export async function loadIndex(): Promise<RegistryEntry[]> {
  return (await readRegistryFile("index.json")) as RegistryEntry[];
}

/** UI and animation libraries shared by every kit (registry/libraries.json). */
export async function loadCatalog(): Promise<Catalog> {
  return catalogSchema.parse(await readRegistryFile("libraries.json"));
}

async function readRegistryFile(file: string): Promise<unknown> {
  const base = registry();
  if (isLocalPath(base)) return JSON.parse(await readFile(resolve(base, file), "utf8"));
  const url = `${process.env.KITS_REGISTRY ? githubRawBase(base) : DEFAULT_RAW_BASE}/${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${file} from the registry (${res.status} ${url})`);
  return res.json();
}

function githubRawBase(source: string): string {
  const [owner, repo, ...path] = source.replace(/^gh:/, "").split("/");
  return `https://raw.githubusercontent.com/${owner}/${repo}/main/${path.join("/")}`;
}

interface PublishedKit {
  version: string;
  repo: string;
  path: string;
  commitSha: string;
  integrity: string;
  /** Private kit: download it with ?archive=1 instead of from GitHub. */
  archive?: boolean;
}

const apiBase = () => process.env.KITS_API_URL ?? BRAND.siteUrl;
const authHeaders = async (): Promise<Record<string, string>> => {
  const token = await getToken();
  return token ? { authorization: `Bearer ${token}` } : {};
};

async function downloadArchive(slug: string, version: string): Promise<Buffer> {
  const res = await fetch(`${apiBase()}/api/v1/kits/${slug}?version=${encodeURIComponent(version)}&archive=1`, {
    headers: await authHeaders(),
    signal: AbortSignal.timeout(60_000),
  });
  if (res.status === 402) {
    const { buyUrl } = (await res.json().catch(() => ({}))) as { buyUrl?: string };
    throw new Error(`es un kit de pago. Cómpralo en ${buyUrl ?? apiBase()} e inicia sesión con \`${BRAND.cli} login\``);
  }
  if (res.status === 401 || res.status === 404) throw new Error(`no tienes acceso. Si es de tu organización, inicia sesión con \`${BRAND.cli} login\``);
  if (!res.ok) throw new Error(`el registro respondió ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Asks the registry whether "owner/name" is a published kit. Unreachable or 404: treat it as a GitHub path. */
async function lookupPublished(slug: string, version?: string): Promise<PublishedKit | null> {
  if (slug.split("/").length !== 2) return null;
  try {
    // With a token, members also see their organization's private kits.
    const res = await fetch(`${apiBase()}/api/v1/kits/${slug}${version ? `?version=${encodeURIComponent(version)}` : ""}`, {
      headers: await authHeaders(),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PublishedKit & { official?: boolean };
    return data.official ? null : data;
  } catch {
    return null;
  }
}
