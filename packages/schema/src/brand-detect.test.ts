import { describe, expect, it } from "vitest";

import { completeProfile, detectFromCss, detectFromJson, detectFromPixels, detectFromSite, parseColor, readHtml } from "./brand-detect";

describe("parseColor", () => {
  it.each([
    ["#E11D48", "#e11d48"],
    ["#fff", "#ffffff"],
    ["#11223344", "#112233"],
    ["rgb(225, 29, 72)", "#e11d48"],
    ["rgb(225 29 72 / 50%)", "#e11d48"],
    ["hsl(0, 100%, 50%)", "#ff0000"],
    ["222.2 84% 4.9%", "#020817"], // shadcn v3 bare HSL
    ["oklch(1 0 0)", "#ffffff"],
    ["oklch(0 0 0)", "#000000"],
    ["oklch(62.8% 0.2577 29.23)", "#ff0000"],
  ])("%s → %s", (input, hex) => expect(parseColor(input)).toBe(hex));

  it.each(["var(--x)", "transparent", "linear-gradient(red, blue)", "currentColor"])("ignores %s", (v) => expect(parseColor(v)).toBeNull());
});

describe("detectFromCss", () => {
  it("reads a shadcn v4 globals.css (oklch), light and dark", () => {
    const css = `@import "tailwindcss";
:root { --radius: 0.625rem; --background: oklch(1 0 0); --foreground: oklch(0.145 0 0); --primary: oklch(0.205 0 0); --primary-foreground: oklch(0.985 0 0); --destructive: oklch(0.577 0.245 27.325); }
.dark { --background: oklch(0.145 0 0); --primary: oklch(0.922 0 0); }
@theme inline { --font-sans: var(--font-geist-sans); }`;
    const { profile } = detectFromCss(css);
    expect(profile.colors.background).toBe("#ffffff");
    expect(profile.colors.primary).toMatch(/^#1[0-9a-f]{5}$/);
    expect(profile.colors.danger).toBeDefined();
    expect(profile.dark?.background).toMatch(/^#0/);
    expect(profile.radius).toBe("0.625rem");
    expect(profile.fonts?.sans).toBeUndefined(); // var(): no family name to guess
  });

  it("reads Tailwind v4 @theme colors and body fonts", () => {
    const { profile } = detectFromCss(`@theme { --color-primary: #e11d48; --color-background: #fafafa; } body { font-family: "Inter", sans-serif; color: #111; }`);
    expect(profile.colors).toMatchObject({ primary: "#e11d48", background: "#fafafa", foreground: "#111111" });
    expect(profile.fonts?.sans).toBe("Inter");
  });

  it("uses the dark palette of a dark-only site and never guesses a status color as primary", () => {
    const { profile } = detectFromCss(`.dark { --background: #000; --foreground: #fafafa; --primary: #fafafa; --destructive: #ff6467; } .x { color: #ff6467 }`);
    expect(profile.colors).toMatchObject({ background: "#000000", primary: "#fafafa", danger: "#ff6467" });
    expect(profile.dark).toBeUndefined();
    const guessed = detectFromCss(`:root { --destructive: #ff6467 } .a { color: #ff6467 } .b { color: #ff6467 } .c { color: #2563eb }`);
    expect(guessed.profile.colors.primary).toBe("#2563eb");
  });

  it("guesses primary from the most used vivid color", () => {
    const { profile, found } = detectFromCss(`a { color: #2563eb } .btn { background: #2563eb } .x { color: #999 }`);
    expect(profile.colors.primary).toBe("#2563eb");
    expect(found).toContain("primary: color más usado");
  });
});

describe("detectFromJson", () => {
  it("accepts a complete brand.json", () => {
    const brand = { name: "web", title: "Acme", colors: { primary: "#e11d48", background: "#fff", foreground: "#000" } };
    expect(detectFromJson(brand).profile.title).toBe("Acme");
  });

  it("reads design tokens", () => {
    const tokens = { color: { brand: { primary: { $value: "#e11d48" } }, background: { value: "#ffffff" } } };
    expect(detectFromJson(tokens).profile.colors).toMatchObject({ primary: "#e11d48", background: "#ffffff" });
  });
});

describe("websites and logos", () => {
  it("prefers theme-color and takes the site name", () => {
    const page = readHtml(`<html><head><title>Acme — Inicio</title><meta name="theme-color" content="#0ea5e9"><link rel="stylesheet" href="/a.css"><style>body{background:#fff}</style></head></html>`);
    expect(page.stylesheets).toEqual(["/a.css"]);
    const { profile } = detectFromSite(page, "");
    expect(profile.title).toBe("Acme");
    expect(profile.colors.primary).toBe("#0ea5e9");
    expect(profile.colors.background).toBe("#ffffff");
  });

  it("takes the dominant vivid color of a logo, ignoring transparency", () => {
    const red = [225, 29, 72, 255];
    const clear = [0, 0, 0, 0];
    const white = [255, 255, 255, 255];
    const pixels = [...Array(50).fill(red).flat(), ...Array(80).fill(clear).flat(), ...Array(20).fill(white).flat()];
    const { profile } = detectFromPixels(pixels);
    expect(profile.colors.primary).toBe("#e11d48");
    expect(profile.colors.primaryForeground).toBe("#ffffff");
  });

  it("completes a partial detection into a valid profile", () => {
    const profile = completeProfile({ profile: { colors: { primary: "#fde047" } }, found: [] }, "web", "Acme");
    expect(profile.colors).toMatchObject({ primary: "#fde047", primaryForeground: "#0a0a0a", background: "#ffffff" });
  });
});
