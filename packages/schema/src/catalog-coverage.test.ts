import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadRegistryKits } from "./node/registry";
import { LIBRARY_CATEGORIES } from "./categories";

const kits = await loadRegistryKits(fileURLToPath(new URL("../../../registry", import.meta.url)));

describe("catalog coverage", () => {
  it("offers testing, CI and a deployment or publishing destination in every kit", () => {
    for (const kit of kits) {
      for (const id of ["testing", "ci", "deploy"]) {
        const option = kit.options.find((o) => o.id === id || (kit.workspace && (o.id.endsWith(`.${id}`) || (id === "ci" && o.id === "deployment")))) ;
        expect(option?.choices.some((c) => c.id !== "none"), `${kit.name}: ${id}`).toBe(true);
      }
    }
  });

  it("offers real choices in every declared catalog category", () => {
    expect(kits).toHaveLength(71);
    const ids = new Set<string>(LIBRARY_CATEGORIES.map((c) => c.optionId));
    for (const kit of kits) {
      for (const option of kit.options.filter((o) => ids.has(o.id))) {
        expect(option.choices.some((c) => c.id !== "none"), `${kit.name}: ${option.id}`).toBe(true);
      }
    }
  });

  it("offers Nuxt deployments with Nuxt output configurations", () => {
    for (const name of ["web-nuxt", "saas-nuxt", "landing-nuxt"]) {
      const kit = kits.find((k) => k.name === name)!;
      const ids = kit.options.find((o) => o.id === "deploy")!.choices.map((c) => c.id);
      expect(ids, name).toEqual(expect.arrayContaining(["vercel", "netlify-nuxt", "docker-nuxt", "railway-nuxt"]));
      expect(ids, name).not.toContain("netlify");
      expect(ids, name).not.toContain("netlify-static");
    }
  });

  it("keeps desktop/extension publishing distinct from web hosting", () => {
    for (const name of ["desktop-electron", "desktop-tauri", "chrome-extension", "vscode-extension"]) {
      const kit = kits.find((k) => k.name === name)!;
      const ids = kit.options.find((o) => o.id === "deploy")!.choices.map((c) => c.id);
      expect(ids.filter((id) => id !== "none"), name).not.toHaveLength(0);
      expect(ids, name).not.toContain("vercel-static");
      expect(ids, name).not.toContain("cloudflare-pages");
    }
  });

  it("does not install service runtime libraries at polyglot workspace roots", () => {
    for (const kit of kits.filter((k) => k.category === "monorepo")) {
      expect(kit.options.some((o) => ["auth", "database", "payments", "email"].includes(o.id)), kit.name).toBe(false);
    }
  });
});
