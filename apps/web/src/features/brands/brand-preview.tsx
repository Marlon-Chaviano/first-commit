"use client";

import type { BrandAssetKind, BrandPalette, BrandProfile } from "@kits/schema";
import { CircleAlertIcon, ImageOffIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Preview = Pick<BrandProfile, "title" | "colors" | "dark" | "fonts" | "radius" | "logo"> & {
  assets?: Partial<BrandProfile["assets"]>;
};

const brandColors = { primary: "Primary", secondary: "Secondary", accent: "Accent" };
const interfaceColors = {
  background: "Background", foreground: "Text", primaryForeground: "On primary",
  muted: "Muted", border: "Border", success: "Success", warning: "Warning", danger: "Error",
};
const assetLabels = {
  logo: "Logo", logoDark: "Dark-mode logo", icon: "Favicon", appleTouchIcon: "App icon", ogImage: "Social image",
} satisfies Record<BrandAssetKind, string>;

function Asset({ kind, src, small = false, className }: { kind: BrandAssetKind; src: string; small?: boolean; className?: string }) {
  const [broken, setBroken] = useState(false);
  const label = assetLabels[kind];
  return (
    <span title={broken ? `${label} unavailable` : label}
      className={cn("inline-flex shrink-0 items-center justify-center self-start",
        small ? "h-7 min-w-7 max-w-20" : "h-10 min-w-10 max-w-24", className)}>
      {broken ? <ImageOffIcon aria-label={`${label} unavailable`} role="img" className="size-4 text-muted-foreground" /> : (
        // eslint-disable-next-line @next/next/no-img-element -- private profiles can contain remote or inline assets
        <img src={src} alt={label} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)}
          className="h-full w-auto max-w-full object-contain" />
      )}
    </span>
  );
}

function Palette({ colors, radius, className }: { colors: BrandPalette; radius?: string; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <dl className="flex gap-1.5">
        {(Object.keys(brandColors) as (keyof typeof brandColors)[]).map((key) => colors[key] && (
          <div key={key} className={cn("min-w-0 flex-1", key === "primary" && "flex-2")}>
            <dt className="text-xs font-medium">
              <span aria-hidden="true" className="mb-1.5 block h-5 rounded-sm ring-1 ring-foreground/15 ring-inset" style={{ backgroundColor: colors[key], borderRadius: radius }} />
              {brandColors[key]}
            </dt>
            <dd className="font-mono text-[11px] text-muted-foreground uppercase">{colors[key]}</dd>
          </div>
        ))}
      </dl>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5">
        {(Object.keys(interfaceColors) as (keyof typeof interfaceColors)[]).map((key) => colors[key] && (
          <div key={key} className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11px]">
            <dt className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-full ring-1 ring-foreground/20 ring-inset" style={{ backgroundColor: colors[key] }} />
              {interfaceColors[key]}
            </dt>
            <dd className="font-mono text-muted-foreground uppercase">{colors[key]}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-2 text-xs">
        <span className="text-muted-foreground">Error preview</span>
        <span className="inline-flex items-center gap-1.5">
          <CircleAlertIcon aria-hidden="true" className="size-3.5 text-destructive" style={{ color: colors.danger }} />
          This field is required.
        </span>
      </div>
    </div>
  );
}

/** The page theme controls the canvas. Only the specimens use the profile's own colors. */
export function BrandPreview({ profile, action, showAssets = true }: { profile: Preview; action?: ReactNode; showAssets?: boolean }) {
  const { title, colors, dark, fonts, radius } = profile;
  const assets = { ...profile.assets, logo: profile.assets?.logo ?? profile.logo };
  const kinds = (Object.keys(assetLabels) as BrandAssetKind[]).filter((kind) => assets[kind]);
  const [main, ...rest] = kinds;
  const pairedLogos = Boolean(assets.logo && assets.logoDark);
  const heading = fonts.heading || fonts.sans;
  const families = [...new Set([fonts.heading, fonts.sans, fonts.mono].filter(Boolean))].join(" / ");

  return (
    <Card size="sm" className="h-full gap-0">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          {pairedLogos && <Asset key={assets.logoDark} kind="logoDark" src={assets.logoDark!} className="[.light_&]:hidden" />}
          {main ? <Asset key={main + assets[main]} kind={main} src={assets[main]!} className={pairedLogos ? "hidden [.light_&]:inline-flex" : undefined} /> : (
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center text-lg font-medium">{title.trim()[0] || "B"}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-base leading-tight font-semibold wrap-anywhere" style={{ fontFamily: heading ? `"${heading}", var(--font-geist-sans, ui-sans-serif), sans-serif` : undefined }}>{title || "Your brand"}</p>
            {families && <p className="mt-0.5 text-xs text-muted-foreground wrap-anywhere">{families}</p>}
          </div>
          {action}
        </div>
        {showAssets && rest.length > 0 && (
          <ul aria-label="Brand assets" className="flex flex-wrap gap-x-3 gap-y-2">
            {rest.map((kind) => (
              <li key={kind} className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                {kind === "logoDark" && pairedLogos ? (
                  <>
                    <span className="flex flex-col gap-1 [.light_&]:hidden"><Asset key={assets.logo} kind="logo" src={assets.logo!} small />Light-mode logo</span>
                    <span className="hidden flex-col gap-1 [.light_&]:flex"><Asset key={assets.logoDark} kind="logoDark" src={assets.logoDark!} small />{assetLabels.logoDark}</span>
                  </>
                ) : (
                  <><Asset key={assets[kind]} kind={kind} src={assets[kind]!} small />{assetLabels[kind]}</>
                )}
              </li>
            ))}
          </ul>
        )}
        <Palette colors={colors} radius={radius} className={dark ? "hidden [.light_&]:block" : undefined} />
        {dark && <Palette colors={{ ...colors, ...dark }} radius={radius} className="[.light_&]:hidden" />}
      </CardContent>
    </Card>
  );
}
