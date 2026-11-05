import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { hashKitDir, verifyIntegrity } from "./integrity";

function kit(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "kits-integrity-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

describe("integrity", () => {
  const files = { "kit.json": '{"name":"a"}', "files/src/x.ts": "export {}", ".DS_Store": "junk" };

  it("is stable across folders and ignores OS junk", () => {
    expect(hashKitDir(kit(files))).toBe(hashKitDir(kit({ ...files, ".DS_Store": "other" })));
  });

  it("changes when any file changes", () => {
    expect(hashKitDir(kit(files))).not.toBe(hashKitDir(kit({ ...files, "files/src/x.ts": "export const y = 1" })));
  });

  it("verifies against the published map", () => {
    const dir = kit(files);
    const map = { a: { "1.0.0": hashKitDir(dir) } };
    expect(() => verifyIntegrity(dir, "a", "1.0.0", map)).not.toThrow();
    expect(() => verifyIntegrity(kit({ ...files, "kit.json": "{}" }), "a", "1.0.0", map)).toThrow(/integridad/);
    expect(() => verifyIntegrity(dir, "a", "2.0.0", map)).toThrow(/No hay hash/);
  });
});
