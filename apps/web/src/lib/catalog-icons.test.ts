import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { LOGO_KEYS } from "./logo-paths";
import { LIBRARY_ICON_FALLBACKS } from "./library-icon-fallbacks";

describe("catalog icons", () => {
  it("provides a publisher mark or a category icon for every catalog entry", () => {
    const catalog = JSON.parse(readFileSync(fileURLToPath(new URL("../../../../registry/libraries.json", import.meta.url)), "utf8")) as { id: string; kind: string }[];
    expect(catalog.length).toBeGreaterThan(0);
    for (const entry of catalog) {
      if (!LOGO_KEYS[entry.id]) expect(LIBRARY_ICON_FALLBACKS[entry.id], entry.id).toBe(entry.kind);
    }
  });
});
