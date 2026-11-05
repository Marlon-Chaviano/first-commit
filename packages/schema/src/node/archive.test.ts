import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { packDir, unpackArchive } from "./archive";
import { hashKitDir } from "./integrity";

describe("kit archives", () => {
  it("round-trips a folder with the same integrity hash", () => {
    const src = mkdtempSync(join(tmpdir(), "pack-"));
    mkdirSync(join(src, "files/src"), { recursive: true });
    writeFileSync(join(src, "kit.json"), '{"name":"x"}');
    writeFileSync(join(src, "files/src/a.ts"), "export const a = 1;\n");
    writeFileSync(join(src, "logo.png"), Buffer.from([0, 255, 10, 13]));
    mkdirSync(join(src, "node_modules/x"), { recursive: true });
    writeFileSync(join(src, "node_modules/x/i.js"), "ignored");

    const out = mkdtempSync(join(tmpdir(), "unpack-"));
    unpackArchive(packDir(src), out);
    expect(hashKitDir(out)).toBe(hashKitDir(src));
    expect([...readFileSync(join(out, "logo.png"))]).toEqual([0, 255, 10, 13]);
  });

  it.each(["../evil.sh", "/etc/passwd", "a/../../evil"])("rejects %s", (path) => {
    const archive = gzipSync(JSON.stringify({ v: 1, files: { [path]: Buffer.from("x").toString("base64") } }));
    expect(() => unpackArchive(archive, mkdtempSync(join(tmpdir(), "unpack-")))).toThrow(/no permitida/);
  });
});
