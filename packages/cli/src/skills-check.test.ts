import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkSkills, declaredSkillName } from "./skills-check";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe("source verification", () => {
  it("verifies conventional skill files without invoking the installer", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("---\nname: safe-code\n---\n"));
    vi.stubGlobal("fetch", fetcher);
    expect(await checkSkills(["example/security@safe-code", "example/security@safe-code"])).toEqual({ missing: [] });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("discovers nested official files through the repository tree", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(Response.json({ tree: [{ path: "plugins/reviews/skills/safe-code/SKILL.md", type: "blob", size: 400 }] }))
      .mockResolvedValueOnce(new Response("---\nname: safe-code\n---\n"));
    vi.stubGlobal("fetch", fetcher);
    expect(await checkSkills(["example/security@safe-code"])).toEqual({ missing: [] });
    expect(fetcher.mock.calls[2]![0]).toContain("/plugins/reviews/skills/safe-code/SKILL.md");
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("does not accept a file that declares another skill and falls back to installation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("---\nname: unrelated\n---\n")));
    vi.mocked(execFileSync).mockImplementation(() => { throw new Error("unavailable"); });
    expect(await checkSkills(["example/security@safe-code"])).toEqual({ missing: ["example/security@safe-code"] });
    expect(execFileSync).toHaveBeenCalledTimes(2);
  });
});

describe("declared skill names", () => {
  it.each([
    ["---\nname: secure-code\ndescription: Review\n---\n# Body", "secure-code"],
    ["---\r\nname: 'secure-code'\r\n---\r\n", "secure-code"],
    ['---\nname: "secure-code"\n---\n', "secure-code"],
    ["# Body\nname: secure-code", undefined],
    ["---\ndescription: Review\n---\nname: secure-code", undefined],
    ["---\nname: secure-code\n", undefined],
    ["---\nname: 'secure-code\n---\n", undefined],
  ])("reads only valid frontmatter from %j", (content, name) => {
    expect(declaredSkillName(content)).toBe(name);
  });
});
