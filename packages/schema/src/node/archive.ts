import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

/** Private kits are stored and served as one archive: gzipped JSON of path → base64 bytes. */
export const ARCHIVE_LIMITS = { bytes: 5 * 1024 * 1024, files: 2000 } as const;

const IGNORED = new Set([".DS_Store", "node_modules", ".git"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (IGNORED.has(name)) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Packs a kit folder (same files hashKitDir hashes). Throws over the size limits. */
export function packDir(dir: string): Buffer {
  const files = walk(dir).sort();
  if (files.length > ARCHIVE_LIMITS.files) throw new Error(`The kit has ${files.length} files (maximum ${ARCHIVE_LIMITS.files})`);
  const entries = Object.fromEntries(files.map((f) => [relative(dir, f).split(sep).join("/"), readFileSync(f).toString("base64")]));
  const archive = gzipSync(JSON.stringify({ v: 1, files: entries }));
  if (archive.length > ARCHIVE_LIMITS.bytes) throw new Error(`The kit is ${(archive.length / 1024 / 1024).toFixed(1)} MB compressed (maximum 5 MB)`);
  return archive;
}

/** Extracts an archive into `dir`. Rejects absolute paths and anything that escapes `dir`. */
export function unpackArchive(archive: Buffer, dir: string): void {
  if (archive.length > ARCHIVE_LIMITS.bytes) throw new Error("Archivo de kit demasiado grande");
  const parsed = JSON.parse(gunzipSync(archive, { maxOutputLength: 64 * 1024 * 1024 }).toString("utf8")) as { v?: number; files?: Record<string, string> };
  if (parsed.v !== 1 || !parsed.files) throw new Error("Unrecognized kit format");
  const root = resolve(dir);
  for (const [path, content] of Object.entries(parsed.files)) {
    const target = resolve(root, path);
    if (path.startsWith("/") || path.includes("\0") || (target !== root && !target.startsWith(root + sep))) {
      throw new Error(`Path not allowed in the kit: ${path}`);
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(content, "base64"));
  }
}
