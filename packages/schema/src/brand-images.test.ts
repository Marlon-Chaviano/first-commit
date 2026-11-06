import { describe, expect, it } from "vitest";

import { imageExtension, isSafeSvg } from "./brand-images";
import { brandProfileSchema } from "./brand-profile";

const svg = (body: string) => `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`)}`;

describe("brand images", () => {
  it("knows image types, and trusts the file name only for octet-stream", () => {
    expect(imageExtension("image/png")).toBe("png");
    expect(imageExtension("image/svg+xml; charset=utf-8")).toBe("svg");
    expect(imageExtension("application/octet-stream", "https://acme.com/favicon.ico?v=2")).toBe("ico");
    expect(imageExtension("", "https://acme.com/logo.jpeg")).toBe("jpg");
    expect(imageExtension("text/html", "https://acme.com/logo.png")).toBeNull();
    expect(imageExtension("application/octet-stream", "https://acme.com/file.exe")).toBeNull();
  });

  it("refuses SVGs that could run code, in uploads too", () => {
    expect(isSafeSvg("<svg><path d='M0 0'/></svg>")).toBe(true);
    expect(isSafeSvg("<svg><script>x()</script></svg>")).toBe(false);
    expect(isSafeSvg("<svg onload='x()'/>")).toBe(false);
    const base = { name: "web", title: "Acme", colors: { primary: "#000000", background: "#ffffff", foreground: "#000000" } };
    expect(brandProfileSchema.safeParse({ ...base, assets: { logo: svg("<circle r='4'/>") } }).success).toBe(true);
    expect(brandProfileSchema.safeParse({ ...base, assets: { logo: svg("<script>alert(1)</script>") } }).success).toBe(false);
  });
});
