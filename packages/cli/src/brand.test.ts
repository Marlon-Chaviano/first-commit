import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { brandProfileSchema } from "@kits/schema";
import { describe, expect, it } from "vitest";

import { applyBrand } from "./brand";

const profile = brandProfileSchema.parse({
  name: "web",
  title: "Acme",
  colors: { primary: "#e11d48", primaryForeground: "#ffffff", background: "#ffffff", foreground: "#0a0a0a", danger: "#b91c1c" },
  fonts: { sans: "Inter" },
  radius: "0.75rem",
  voice: "Cercano y directo, de tú.",
  rules: ["Botones principales siempre en el color principal", "Nada de sombras grandes"],
  docs: { "guia.md": "# Guía de estilo\n\nUsa fotos reales." },
});

describe("applyBrand", () => {
  it("writes docs, tokens, shadcn variables and an AGENTS.md block, idempotently", () => {
    const dir = mkdtempSync(join(tmpdir(), "brand-"));
    mkdirSync(join(dir, "src/app"), { recursive: true });
    writeFileSync(join(dir, "src/app/globals.css"), ':root { --primary: oklch(0.2 0 0); }\n');
    writeFileSync(join(dir, "AGENTS.md"), "# Proyecto\n\nReglas mías.\n");

    applyBrand(profile, dir);
    applyBrand(profile, dir); // twice: still one block each

    const css = readFileSync(join(dir, "src/app/globals.css"), "utf8");
    expect(css.match(/kits-brand:start/g)).toHaveLength(1);
    expect(css).toContain("--brand-primary: #e11d48;");
    expect(css).toContain("--primary: var(--brand-primary);");
    expect(css).toContain("--destructive: var(--brand-danger);");
    expect(css).toContain("--radius: 0.75rem;");
    expect(css.indexOf("oklch")).toBeLessThan(css.indexOf("kits-brand")); // the brand goes last and wins

    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents).toContain("Reglas mías.");
    expect(agents.match(/kits-brand:start/g)).toHaveLength(1);
    expect(agents).toContain("Nada de sombras grandes");

    expect(readFileSync(join(dir, "docs/brand/guia.md"), "utf8")).toContain("Usa fotos reales");
    expect(JSON.parse(readFileSync(join(dir, "docs/brand/tokens.json"), "utf8")).color.primary.$value).toBe("#e11d48");
  });

  it("writes a standalone brand.css when the project has no global stylesheet", () => {
    const dir = mkdtempSync(join(tmpdir(), "brand-"));
    const written = applyBrand(profile, dir);
    expect(written).toContain("docs/brand/brand.css");
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toContain("docs/brand/brand.css");
  });

  it("rejects invalid colors and doc names", () => {
    expect(() => brandProfileSchema.parse({ ...profile, colors: { ...profile.colors, primary: "red" } })).toThrow();
    expect(() => brandProfileSchema.parse({ ...profile, docs: { "../x.md": "x" } })).toThrow();
  });
});
