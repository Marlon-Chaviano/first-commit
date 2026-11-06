import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { brandProfileSchema } from "@kits/schema";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applyBrand, downloadBrandAssets, readBrandImage } from "./brand";

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

describe("brand images", () => {
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
  const dataPng = `data:image/png;base64,${png.toString("base64")}`;
  const svg = (body: string) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`).toString("base64")}`;
  afterEach(() => vi.unstubAllGlobals());

  it("decodes inline images and refuses SVGs with scripts", async () => {
    expect((await readBrandImage(dataPng)).ext).toBe("png");
    expect((await readBrandImage(svg("<circle r='4'/>"))).ext).toBe("svg");
    await expect(readBrandImage(svg("<script>alert(1)</script>"))).rejects.toThrow(/scripts/);
    await expect(readBrandImage(svg("<rect onload='x()'/>"))).rejects.toThrow(/scripts/);
  });

  it("saves them in public/brand, replaces the default favicon and lists them in BRAND.md and AGENTS.md", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brand-"));
    mkdirSync(join(dir, "public"));
    mkdirSync(join(dir, "src/app"), { recursive: true });
    writeFileSync(join(dir, "src/app/layout.tsx"), "export default function L() {}\n");
    writeFileSync(join(dir, "public/favicon.png"), "old");
    // Remote favicon served as octet-stream: the .png in its name decides the type.
    vi.stubGlobal("fetch", vi.fn(async () => new Response(png, { headers: { "content-type": "application/octet-stream" } })));
    const branded = brandProfileSchema.parse({ ...profile, assets: { logo: svg("<circle r='4'/>"), icon: "https://acme.com/favicon.png", ogImage: "https://acme.com/og.png" } });

    const { files, written, skipped } = await downloadBrandAssets(branded, dir);
    expect(skipped).toEqual([]);
    expect(files).toEqual({ logo: "public/brand/logo.svg", icon: "public/brand/favicon.png", ogImage: "public/brand/og-image.png" });
    expect(readFileSync(join(dir, "public/favicon.png"))).toEqual(png);
    expect(written).toContain("public/favicon.png");
    expect(existsSync(join(dir, "src/app/icon.png"))).toBe(false); // an existing favicon was replaced instead

    applyBrand(branded, dir, files);
    expect(readFileSync(join(dir, "docs/brand/BRAND.md"), "utf8")).toContain("`public/brand/logo.svg`");
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents).toContain("public/brand/");
    expect(agents).toContain("Never redraw");
  });

  it("skips images it can't fetch without failing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brand-"));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    const branded = brandProfileSchema.parse({ ...profile, assets: { icon: "https://acme.com/missing.ico" } });
    const { files, skipped } = await downloadBrandAssets(branded, dir);
    expect(files).toEqual({});
    expect(skipped).toEqual(["Favicon: HTTP 404"]);
  });
});
