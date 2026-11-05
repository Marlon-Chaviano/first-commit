import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const IGNORED = new Set([".DS_Store", "node_modules", ".git"]);

/**
 * Deterministic hash of a kit folder: every file's relative path and bytes, in
 * sorted order. Matches what giget extracts, so the CLI can compare a download
 * against registry/integrity.json.
 */
export function hashKitDir(dir: string): string {
  const files = walk(dir).sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(relative(dir, file).split(sep).join("/"));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return `sha256-${hash.digest("base64")}`;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (IGNORED.has(name)) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** kit → version → hash */
export type IntegrityMap = Record<string, Record<string, string>>;

/** Throws when a downloaded official kit doesn't match the hash published for its version. */
export function verifyIntegrity(dir: string, name: string, version: string, map: IntegrityMap): void {
  const expected = map[name]?.[version];
  if (!expected) throw new Error(`No hay hash publicado para ${name}@${version}: no se puede comprobar que el kit no fue alterado.`);
  const actual = hashKitDir(dir);
  if (actual !== expected) {
    throw new Error(`El kit ${name}@${version} descargado no coincide con el publicado (integridad). No se ha ejecutado nada.`);
  }
}
