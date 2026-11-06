import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { KitsLock } from "@kits/schema";
import { describe, expect, it } from "vitest";

import { diagnose } from "./doctor";

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "kits-doctor-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

const lock: KitsLock = {
  lockVersion: 1,
  kit: null,
  version: null,
  options: {},
  skills: ["anthropics/skills@frontend-design"],
  agents: ["claude-code", "cursor"],
  pm: "pnpm",
  dependencies: [],
  devDependencies: [],
  added: [],
  addedSkills: [],
  managedFiles: { "src/kept.ts": "x", "src/gone.ts": "y" },
  brand: null,
  updatedAt: new Date().toISOString(),
};

describe("doctor", () => {
  it("reports missing env vars, skills per agent and deleted managed files", async () => {
    const dir = project({
      ".env.example": "API_URL=\nSECRET=\n",
      ".env": "API_URL=https://x\nSECRET=\n",
      ".claude/skills/frontend-design/SKILL.md": "",
      "src/kept.ts": "",
    });
    const findings = await diagnose(dir, lock, false);
    const by = (check: string) => findings.filter((f) => f.check === check).map((f) => f.message);
    expect(by("env")).toEqual(["Empty variables: SECRET."]);
    expect(by("skills")).toEqual(["The frontend-design skill isn't installed for cursor."]);
    expect(by("files")).toEqual(["Kit files that no longer exist: src/gone.ts."]);
    expect(findings.find((f) => f.check === "skills")!.level).toBe("error");
  });

  it("is clean when everything is in place", async () => {
    const dir = project({
      ".env.example": "API_URL=\n",
      ".env.local": "API_URL=https://x\n",
      ".claude/skills/frontend-design/SKILL.md": "",
      ".agents/skills/frontend-design/SKILL.md": "",
      "src/kept.ts": "",
      "src/gone.ts": "",
    });
    expect(await diagnose(dir, lock, false)).toEqual([]);
  });
});
