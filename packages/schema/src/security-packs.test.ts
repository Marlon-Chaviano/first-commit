import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import { loadRegistryKits } from "./node/registry";
import { agentsSection, buildPlan } from "./plan";
import { buildInitCommand, resolve } from "./resolve";
import type { Kit } from "./schema";
import { selectionsFrom } from "./selections";

const registry = fileURLToPath(new URL("../../../registry", import.meta.url));
let kits: Kit[];
beforeAll(async () => { kits = await loadRegistryKits(registry); });

describe("official security pack", () => {
  it("offers one general pack with 12 skills by default in every official kit", () => {
    expect(kits.length).toBeGreaterThan(0);
    for (const kit of kits) {
      const { selections } = selectionsFrom(kit, {});
      expect(selections.options.security, kit.name).toEqual(["security-pack"]);
      const option = kit.options.find((o) => o.id === "security")!;
      expect(option.choices.map((c) => c.id), kit.name).toEqual(["security-pack"]);
      expect(option.choices[0]!.skills, kit.name).toHaveLength(12);
      const result = resolve(kit, selections);
      expect(result.skills, kit.name).toContain("OWASP/secure-agent-playbook@code-review-security");
      expect(result.skills, kit.name).toContain("trailofbits/skills@sharp-edges");
      for (const skill of ["web-security-review", "mobile-code-review", "iac-security-review", "llm-risk-assess", "mcp-server-review"]) {
        expect(result.skills, kit.name).toContain(`OWASP/secure-agent-playbook@${skill}`);
      }
      expect(result.skills.filter((s) => s.endsWith("@security-and-hardening")), kit.name).toHaveLength(1);
      const instructions = agentsSection(kit, result);
      expect(instructions, kit.name).toContain("server-side authorization");
      expect(instructions, kit.name).toContain("not proof of security");
      expect(instructions, kit.name).toContain("Using an AI coding assistant alone does not make the project an AI application");
      expect(instructions, kit.name).toContain("applicable and non-applicable checks with reasons");
    }
  });

  it("can disable the pack without leaving its skills or instructions in the plan", () => {
    const kit = kits.find((k) => k.name === "web-next")!;
    const { selections } = selectionsFrom(kit, { options: { security: [] } });
    const result = resolve(kit, selections);
    expect(result.skills).not.toContain("OWASP/secure-agent-playbook@code-review-security");
    // Essentials still provides general secure coding guidance, independently of this pack.
    expect(result.skills).toContain("addyosmani/agent-skills@security-and-hardening");
    expect(agentsSection(kit, result)).not.toContain("## Security pack");
    expect(buildInitCommand(kit.name, kit, selections)).toContain("--security none");
  });

  it("keeps the general pack when updating selections from the former split packs", () => {
    const kit = kits.find((k) => k.name === "mcp-server-ts")!;
    for (const security of [["security-pack", "security-ai-pack"], ["security-ai-pack"]]) {
      const { selections } = selectionsFrom(kit, { options: { security } }, { unknown: "ignore" });
      expect(selections.options.security).toEqual(["security-pack"]);
      const result = resolve(kit, selections);
      expect(result.skills).toContain("OWASP/secure-agent-playbook@code-review-security");
      expect(result.skills).toContain("OWASP/secure-agent-playbook@mcp-server-review");
    }
  });

  it("plans grouped installs and honors removal of an individual security skill", () => {
    const kit = kits.find((k) => k.name === "cli-node")!;
    const { selections } = selectionsFrom(kit, {});
    selections.removeSkills = ["OWASP/secure-agent-playbook@secrets-scan"];
    const steps = buildPlan({ kit, kitDir: "/kit", sel: selections, parentDir: "/tmp", name: "app", git: false });
    const owasp = steps.filter((s) => s.kind === "run" && s.command.includes("add OWASP/secure-agent-playbook"));
    expect(owasp).toHaveLength(1);
    expect(owasp[0]).toMatchObject({ command: expect.stringContaining("code-review-security api-security-review sca-audit") });
    expect(resolve(kit, selections).skills).not.toContain("OWASP/secure-agent-playbook@secrets-scan");
  });
});
