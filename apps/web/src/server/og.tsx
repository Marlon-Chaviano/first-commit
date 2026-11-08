import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { BRAND } from "@kits/schema";
import { ImageResponse } from "next/og";

import { logosFor } from "@/lib/logos";

/**
 * The Open Graph card shared by kits and stacks: what X, LinkedIn, Slack or Discord show when
 * someone pastes the link. Black and white like the site, in Geist (the TTFs live in
 * assets/fonts: the image renderer can't use next/font).
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;

const ASSETS = join(process.cwd(), "assets/fonts");
const fonts = Promise.all([
  readFile(join(ASSETS, "Geist-Regular.ttf")),
  readFile(join(ASSETS, "Geist-SemiBold.ttf")),
  readFile(join(ASSETS, "GeistMono-Regular.ttf")),
  readFile(join(ASSETS, "GeistMono-Medium.ttf")),
]);
const symbol = readFile(join(process.cwd(), "public/brand/first-commit-symbol-white.svg"), "base64").then((b) => `data:image/svg+xml;base64,${b}`);

const WHITE = "#fafafa";
const MUTED = "#a1a1a1";
const BORDER = "#2e2e2e";

export interface OgCard {
  /** Small label over the title: "Official kit", "Stack", "Community kit by @ana". */
  eyebrow: string;
  title: string;
  description: string;
  /** Logo keys (lib/logos.ts): the kit's tags and chosen libraries. */
  logos: readonly string[];
  command: string;
  /** Short facts on the right of the eyebrow: "Verified", "29 skills"… */
  facts?: string[];
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export async function ogCard(card: OgCard, init?: ResponseInit): Promise<ImageResponse> {
  const [[sans, sansSemi, mono, monoMedium], logo] = await Promise.all([fonts, symbol]);
  const icons = logosFor(card.logos, 4);
  const titleSize = card.title.length > 40 ? 56 : card.title.length > 26 ? 64 : 76;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#000", color: WHITE, padding: "60px 72px", fontFamily: "Geist" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>. */}
            <img src={logo} width={44} height={44} alt="" />
            <span style={{ fontFamily: "Geist Mono", fontWeight: 500, fontSize: 30, letterSpacing: -0.5 }}>{BRAND.name}</span>
          </div>
          {/* The stack as a recipe: Next.js + Supabase + Stripe. */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {icons.map(({ key, icon }, i) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {i > 0 && <span style={{ fontFamily: "Geist Mono", fontSize: 24, color: "#5c5c5c" }}>+</span>}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 60, height: 60, border: `1px solid ${BORDER}`, borderRadius: 14 }}>
                  <svg viewBox="0 0 24 24" width={30} height={30} fill={WHITE}>
                    <path d={icon.path} />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "Geist Mono", fontSize: 22, color: MUTED }}>
            <span style={{ textTransform: "uppercase", letterSpacing: 4 }}>{card.eyebrow}</span>
            {(card.facts ?? []).map((fact) => (
              <span key={fact} style={{ display: "flex", border: `1px solid ${BORDER}`, borderRadius: 999, padding: "4px 14px" }}>
                {fact}
              </span>
            ))}
          </div>
          <span style={{ fontWeight: 600, fontSize: titleSize, lineHeight: 1.05, letterSpacing: -2 }}>{clip(card.title, 56)}</span>
          <span style={{ fontSize: 28, lineHeight: 1.35, color: MUTED, maxWidth: 1040 }}>{clip(card.description, 120)}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, alignSelf: "flex-start", background: "#141414", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "18px 26px", fontFamily: "Geist Mono", fontSize: 28 }}>
          <span style={{ color: MUTED }}>$</span>
          <span>{clip(card.command, 64)}</span>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Geist", data: sans, weight: 400, style: "normal" },
        { name: "Geist", data: sansSemi, weight: 600, style: "normal" },
        { name: "Geist Mono", data: mono, weight: 400, style: "normal" },
        { name: "Geist Mono", data: monoMedium, weight: 500, style: "normal" },
      ],
      // Cards change only when a kit does: let the CDN keep them.
      headers: { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
      ...init,
    },
  );
}

/** Where a kit's or a stack's card is served (used in their metadata and the sitemap). */
export const ogImageUrl = (kind: "kits" | "stacks", slug: string) => `/og/${kind}/${slug}`;
