import { describe, expect, it } from "vitest";

import { cleanFamily, metaRefreshUrl, shellCanonical, detectFromCss, detectFromJson, detectFromManifest, detectFromPixels, detectFromSite, mergeDetections, parseColor, readHtml } from "./brand-detect";
import { completeProfile } from "./brand-draft";
import { brandProfileSchema, socialNetworkOf } from "./brand-profile";

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

  it("guesses primary from buttons and links, not from how often a color appears", () => {
    const { profile, found, candidates } = detectFromCss(`a { color: #2563eb } .btn { background: #2563eb } .x { color: #999 }`);
    expect(profile.colors.primary).toBe("#2563eb");
    expect(found).toContain("primary: buttons");
    expect(candidates?.primary[0]).toEqual({ value: "#2563eb", source: "buttons" });
  });

  it("ignores utility palettes and groups shades of the same color", () => {
    const tailwind = Array.from({ length: 30 }, (_, i) => `--color-red-${i * 10}: #ef4444; --tw-ring: #f97316;`).join(" ");
    const css = `:root { ${tailwind} } .badge { color: #ef4444 } .btn-primary { background: #7c3aed } .btn-primary:hover { background: #7e3af0 }`;
    const { profile, candidates } = detectFromCss(css);
    expect(profile.colors.primary).toBe("#7c3aed");
    expect(candidates?.primary.filter((c) => c.value.startsWith("#7"))).toHaveLength(1);
  });

  it("cleans next/font names, finds the heading font and the button radius", () => {
    const css = `body { font-family: '__Inter_d65c78', '__Inter_Fallback_d65c78', sans-serif } h1, h2 { font-family: "__GeistSans_3a0388" } .button { border-radius: 9999px } .btn { border-radius: 0.5rem }`;
    const { profile } = detectFromCss(css);
    expect(profile.fonts).toEqual({ sans: "Inter", heading: "Geist Sans" });
    expect(cleanFamily("ABCFavorit")).toBe("ABCFavorit");
    expect(cleanFamily("Inter Variable")).toBe("Inter");
    expect(cleanFamily("Apple Color Emoji")).toBeUndefined();
    // var() chains resolve, and a monospace family never becomes the body font.
    expect(detectFromCss(`:root { --font-geist: "Geist", sans-serif; --font-sans: var(--font-geist) } pre, code, kbd { font-family: SFMono-Regular } .a { font-family: SFMono-Regular }`).profile.fonts).toEqual({ sans: "Geist", mono: "SFMono-Regular" });
    expect(profile.radius).toBe("0.5rem");
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

describe("site assets", () => {
  it("captures the inline SVG logo in the header, without scripts, and votes with its colors", () => {
    const html = `<header><a href="/" class="brand"><svg viewBox="0 0 10 10" onload="x()"><script>alert(1)</script><path fill="#e11d48" d="M0 0h10v10z"/></svg></a><nav><a href="/pricing"><svg><use href="#i"/></svg></a></nav></header>`;
    const page = readHtml(html);
    expect(page.logos[0]?.source).toBe("the header (inline SVG)");
    const svg = Buffer.from(page.logos[0]!.value.split(",")[1]!, "base64").toString("utf8");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).not.toMatch(/script|onload/);
    const { profile, candidates } = detectFromSite(page, `.btn { background: #2563eb }`, "https://acme.com", { logoSvgs: [svg] });
    expect(profile.colors.primary).toBe("#e11d48");
    expect(candidates?.primary.map((c) => c.value)).toEqual(["#e11d48", "#2563eb"]);
  });

  it("treats a gray or black logo as a monochrome brand unless the site names a brand color", () => {
    const logo = `<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000" d="M0 0h1v1z"/></svg>`;
    const mono = detectFromSite(readHtml(""), `a { color: #2383e2 }`, "https://acme.com", { logoSvgs: [logo] });
    expect(mono.profile.colors.primary).toBe("#0a0a0a");
    expect(mono.primaryConfident).toBe(true);
    const named = detectFromSite(readHtml(""), `:root { --brand: #5e6ad2 }`, "https://acme.com", { logoSvgs: [logo] });
    expect(named.profile.colors.primary).toBe("#5e6ad2");
    // currentColor logos: monochrome is only a guess, and the footer's Facebook blue never wins.
    const guess = detectFromSite(readHtml(""), `.footer a { color: #1877f2 } a { color: #e11d48 }`, "https://acme.com", { logoSvgs: [`<svg><path fill="currentColor"/></svg>`] });
    expect(guess.primaryConfident).toBe(false);
    expect(guess.candidates?.primary.map((c) => c.value)).toEqual(["#0a0a0a", "#e11d48"]);
  });

  it("treats a dark theme-color as the background and lists the same logo once", () => {
    const page = readHtml(`<meta name="theme-color" content="#17222F"><script type="application/ld+json">{"logo":"/logo.png"}</script><header><a href="/"><img src="/logo.png"></a></header>`);
    const { profile, candidates } = detectFromSite(page, `.spinner { border-top-color: #fd7100 } a:hover { color: #fd7100 }`, "https://acme.com");
    expect(profile.colors.background).toBe("#17222f");
    expect(profile.colors.primary).toBe("#fd7100");
    expect(candidates?.logo).toHaveLength(1);
  });

  it("follows language pickers and loading shells to the real page", () => {
    expect(metaRefreshUrl(`<meta http-equiv="refresh" content="0;url=/es">`)).toBe("/es");
    expect(metaRefreshUrl(`<meta http-equiv="refresh" content="300">`)).toBeUndefined();
    expect(metaRefreshUrl(`<meta http-equiv="refresh" content="600; url=/news">`)).toBeUndefined();
    expect(shellCanonical(`<link rel="canonical" href="https://acme.com/es"><p>Loading…</p>`)).toBe("https://acme.com/es");
    expect(shellCanonical(`<link rel="canonical" href="https://acme.com/"><header>…</header>`)).toBeUndefined();
  });

  it("takes the image inside the home link as the logo, whatever it's called", () => {
    const page = readHtml(`<header><a href="/es" aria-label="Acme"><img src="/brand.png" alt=""></a><a href="/es/pricing"><img src="/promo.png"></a></header>`);
    expect(page.logos).toEqual([{ value: "/brand.png", source: "the header image" }]);
  });

  it("drops images the server couldn't load and strips 'Home' from the name", () => {
    const page = readHtml(`<title>Acme - Home</title><link rel="icon" href="/broken.svg"><link rel="icon" href="/ok.png" sizes="32x32">`);
    const { profile, candidates } = detectFromSite(page, "", "https://acme.com", { reachable: new Set(["https://acme.com/ok.png"]) });
    expect(profile.title).toBe("Acme");
    expect(profile.assets?.icon).toBe("https://acme.com/ok.png");
    expect(candidates?.icon.map((c) => c.value)).toEqual(["https://acme.com/ok.png"]);
  });

  const html = `<html><head>
    <title>Acme | Home</title>
    <meta name="description" content="Payments for teams &amp; startups">
    <meta property="og:image" content="/og.png">
    <link rel="icon" href="/favicon-32.png" sizes="32x32">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <link rel="manifest" href="/site.webmanifest">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Space+Grotesk&display=swap" rel="stylesheet">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","logo":{"url":"https://cdn.acme.com/logo.svg"},"sameAs":["https://www.linkedin.com/company/acme","https://x.com/acme"]}</script>
  </head><body>
    <a href="https://github.com/acme">GitHub</a>
    <a href="https://twitter.com/intent/tweet?text=hi">Share</a>
    <img class="site-logo" src="/img/header-logo.png">
  </body></html>`;

  it("finds the logo, favicons, social image, fonts and profiles", () => {
    const page = readHtml(html);
    expect(page.icon).toBe("/favicon.svg");
    expect(page.manifest).toBe("/site.webmanifest");
    expect(page.googleFonts).toEqual(["Inter", "Space Grotesk"]);
    const { profile, found } = detectFromSite(page, "", "https://acme.com/en/home");
    expect(profile.description).toBe("Payments for teams & startups");
    expect(profile.website).toBe("https://acme.com");
    expect(profile.assets).toEqual({
      logo: "https://cdn.acme.com/logo.svg",
      icon: "https://acme.com/favicon.svg",
      appleTouchIcon: "https://acme.com/apple-touch-icon.png",
      ogImage: "https://acme.com/og.png",
    });
    expect(profile.fonts).toMatchObject({ sans: "Inter", heading: "Space Grotesk" });
    expect(profile.social).toEqual({ linkedin: "https://www.linkedin.com/company/acme", x: "https://x.com/acme", github: "https://github.com/acme" });
    expect(found).toContain("logo: the site's schema.org data");
  });

  it("falls back to an <img> marked as the logo and to /favicon.ico", () => {
    const { profile } = detectFromSite(readHtml(`<img alt="Acme logo" src="logo.png">`), "", "https://acme.com/a/");
    expect(profile.assets).toEqual({ logo: "https://acme.com/a/logo.png", icon: "https://acme.com/favicon.ico" });
  });

  it("reads a web manifest and merges it without overriding the page", () => {
    const manifest = detectFromManifest(
      { name: "Acme App", theme_color: "#7c3aed", background_color: "#ffffff", icons: [{ src: "/i-192.png", sizes: "192x192" }, { src: "/i-512.png", sizes: "512x512" }] },
      "https://acme.com/",
    );
    expect(manifest.profile.assets).toEqual({ appleTouchIcon: "https://acme.com/i-512.png" });
    const merged = mergeDetections(detectFromSite(readHtml(html), "", "https://acme.com"), manifest);
    expect(merged.profile.title).toBe("Acme");
    expect(merged.profile.assets?.appleTouchIcon).toBe("https://acme.com/apple-touch-icon.png");
    expect(merged.profile.colors.primary).toBe("#7c3aed");
  });

  it("validates assets: URLs or small inline images, never scripts", () => {
    const base = { name: "acme", title: "Acme", colors: { primary: "#000000", background: "#ffffff", foreground: "#000000" } };
    expect(brandProfileSchema.safeParse({ ...base, assets: { icon: "data:image/png;base64,iVBORw0KGgo=" } }).success).toBe(true);
    expect(brandProfileSchema.safeParse({ ...base, assets: { icon: "javascript:alert(1)" } }).success).toBe(false);
    expect(brandProfileSchema.safeParse({ ...base, assets: { logo: "data:text/html;base64,PHNjcmlwdD4=" } }).success).toBe(false);
    expect(socialNetworkOf("https://www.youtube.com/@acme")).toBe("youtube");
    expect(socialNetworkOf("https://example.com")).toBeNull();
  });
});
