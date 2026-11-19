import { fileURLToPath } from "node:url";

import { brandProfileSchema } from "@kits/schema";
import { expect, it, vi } from "vitest";

import { brandTemplates } from "@/features/brands/templates";

import { draftFromTemplate } from "./brand-templates";

it("opens each catalog entry as a distinct, portable profile with its own logo", async () => {
  const cwd = vi.spyOn(process, "cwd").mockReturnValue(fileURLToPath(new URL("../../", import.meta.url)));
  try {
    const drafts = await Promise.all(brandTemplates.map(draftFromTemplate));
    expect(new Set(drafts.map((d) => d.name)).size).toBe(brandTemplates.length);
    for (const draft of drafts) {
      expect(brandProfileSchema.safeParse(draft).success).toBe(true);
      const base64 = draft.assets.logo?.split(",")[1] ?? "";
      expect(draft.assets.logo).toMatch(/^data:image\/svg\+xml;base64,/);
      expect(Buffer.from(base64, "base64").toString("utf8")).toMatch(/^<svg\b/);
    }
  } finally {
    cwd.mockRestore();
  }
});
