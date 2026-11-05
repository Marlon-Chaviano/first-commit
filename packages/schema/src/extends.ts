/**
 * `extends`: a kit declares only what differs from another kit.
 *
 * Works on raw kit.json objects, before parseKit, so a child can omit required
 * fields it inherits. File directories (`files`) are made absolute against the
 * kit that declares them, because parent and child live in different folders.
 */

type Raw = Record<string, unknown>;

export interface LoadedRawKit {
  raw: Raw;
  /** Directory the kit was loaded from (its `files` are relative to it). */
  dir: string;
}

export type RawKitLoader = (ref: string) => Promise<LoadedRawKit>;

/** Joins a kit directory and one of its relative paths. Injected so this module stays runtime-agnostic. */
export type PathResolver = (dir: string, path: string) => string;

export const MAX_EXTENDS_DEPTH = 3;

/** Lists concatenated without duplicates (by value, or by JSON for objects). */
const CONCAT = ["tags", "dependencies", "devDependencies", "skills", "postInstall", "setupTasks", "writeFiles", "packageManagers"];
/** Objects merged key by key, child wins. */
const MERGE = ["mcp", "env", "libraries", "addCommand"];
/** Never inherited: they identify the child. */
const OWN = ["name", "version", "extends", "$schema"];

/**
 * Follows the `extends` chain and returns one merged raw kit. Throws on cycles
 * or chains deeper than MAX_EXTENDS_DEPTH.
 */
export async function resolveExtends(
  kit: LoadedRawKit,
  load: RawKitLoader,
  resolvePath: PathResolver,
  chain: LoadedRawKit[] = [],
): Promise<Raw> {
  const raw = absolutizeFiles(kit.raw, kit.dir, resolvePath);
  const parentRef = typeof raw.extends === "string" ? raw.extends : undefined;
  if (!parentRef) return raw;

  const path = [...chain, kit];
  const names = () => path.map((k) => String(k.raw.name ?? "?")).join(" → ");
  if (path.length > MAX_EXTENDS_DEPTH) {
    throw new Error(`"extends" admite como máximo ${MAX_EXTENDS_DEPTH} niveles: ${names()} → ${parentRef}`);
  }
  const parent = await load(parentRef);
  // Compare folders, not refs: "../b" and "b" can be the same kit.
  if (path.some((k) => k.dir === parent.dir)) {
    throw new Error(`"extends" forma un ciclo: ${names()} → ${String(parent.raw.name ?? parentRef)}`);
  }
  return mergeKits(await resolveExtends(parent, load, resolvePath, path), raw);
}

/** Merges a resolved parent with a child. Exported for tests and for tools that already hold both. */
export function mergeKits(parent: Raw, child: Raw): Raw {
  const out: Raw = {};
  for (const [key, value] of Object.entries(parent)) if (!OWN.includes(key)) out[key] = value;

  for (const [key, value] of Object.entries(child)) {
    if (key === "extends") continue;
    const inherited = out[key];
    if (CONCAT.includes(key) && Array.isArray(inherited) && Array.isArray(value)) {
      out[key] = uniqueBy([...inherited, ...value]);
    } else if (MERGE.includes(key) && isObject(inherited) && isObject(value)) {
      out[key] = { ...inherited, ...value };
    } else if (key === "instructions" && typeof inherited === "string" && typeof value === "string") {
      out[key] = `${inherited}\n\n${value}`;
    } else if (key === "files" && inherited !== undefined && value !== undefined) {
      out[key] = uniqueBy(([] as unknown[]).concat(inherited, value));
    } else if (key === "options" && Array.isArray(inherited) && Array.isArray(value)) {
      out[key] = mergeOptions(inherited as Raw[], value as Raw[]);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Options merge by id: a child option replaces the parent's whole option; new ones are appended. */
function mergeOptions(parent: Raw[], child: Raw[]): Raw[] {
  const byId = new Map(child.map((o) => [o.id, o]));
  const merged = parent.map((o) => byId.get(o.id) ?? o);
  const parentIds = new Set(parent.map((o) => o.id));
  return [...merged, ...child.filter((o) => !parentIds.has(o.id))];
}

/** Rewrites every `files` (kit level and per choice) as an absolute path of the declaring kit. */
function absolutizeFiles(raw: Raw, dir: string, resolvePath: PathResolver): Raw {
  const fix = (files: unknown) =>
    typeof files === "string"
      ? resolvePath(dir, files)
      : Array.isArray(files)
        ? files.map((f) => (typeof f === "string" ? resolvePath(dir, f) : f))
        : files;

  const out: Raw = { ...raw };
  if (out.files !== undefined) out.files = fix(out.files);
  if (Array.isArray(out.options)) {
    out.options = (out.options as Raw[]).map((option) => ({
      ...option,
      choices: Array.isArray(option.choices)
        ? (option.choices as Raw[]).map((c) => (c.files === undefined ? c : { ...c, files: fix(c.files) }))
        : option.choices,
    }));
  }
  return out;
}

/** "landing-next@1.2.0" → "landing-next" */
export function stripVersion(ref: string): string {
  return splitKitRef(ref).base;
}

/**
 * Splits a kit reference into base and version. Local paths never carry a version.
 *   "landing-next@1.2.0"       → { base: "landing-next", version: "1.2.0" }
 *   "user/repo/kit@v2.0.0"     → { base: "user/repo/kit", version: "v2.0.0" }
 */
export function splitKitRef(ref: string): { base: string; version?: string } {
  if (ref.startsWith(".") || ref.startsWith("/")) return { base: ref };
  const at = ref.lastIndexOf("@");
  if (at <= 0) return { base: ref };
  return { base: ref.slice(0, at), version: ref.slice(at + 1) };
}

function isObject(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueBy<T>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = typeof item === "string" ? item : JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
