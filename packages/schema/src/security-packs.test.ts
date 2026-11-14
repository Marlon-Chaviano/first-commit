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

describe("official security packs", () => {
  it("installs the base pack by default in every official kit, including inherited kits", () => {
    expect(kits.length).toBeGreaterThan(0);
    for (const kit of kits) {
      const { selections } = selectionsFrom(kit, {});
      expect(selections.options.security, kit.name).toContain("security-pack");
      const result = resolve(kit, selections);
      expect(result.skills, kit.name).toContain("OWASP/secure-agent-playbook@code-review-security");
      expect(result.skills, kit.name).toContain("trailofbits/skills@sharp-edges");
      expect(result.skills.filter((s) => s.endsWith("@security-and-hardening")), kit.name).toHaveLength(1);
      const instructions = agentsSection(kit, result);
      expect(instructions, kit.name).toContain("server-side authorization");
      expect(instructions, kit.name).toContain("not proof of security");
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

  it("selects AI reviews by default for AI and MCP kits, and can add them elsewhere", () => {
    for (const name of ["saas-ai-next", "ai-agent-python", "mcp-server-ts", "mcp-server-python"]) {
      const kit = kits.find((k) => k.name === name)!;
      const { selections } = selectionsFrom(kit, {});
      expect(selections.options.security, name).toContain("security-ai-pack");
      expect(resolve(kit, selections).skills, name).toContain("OWASP/secure-agent-playbook@mcp-server-review");
    }
    const kit = kits.find((k) => k.name === "web-next")!;
    const { selections, added } = selectionsFrom(kit, { options: { security: ["security-ai-pack"] } }, { requirements: "autofill" });
    expect(added).toContainEqual({ optionId: "security", choiceId: "security-pack", label: "Security pack" });
    expect(resolve(kit, selections).skills).toContain("OWASP/secure-agent-playbook@llm-risk-assess");
    const disabled = selectionsFrom(kit, { base: selections, options: { security: ["security-ai-pack"] } }, { requirements: "prune" });
    expect(disabled.selections.options.security).toEqual([]);
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
