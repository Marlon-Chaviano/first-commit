"use client";

import { BRAND_ASSETS, SOCIAL_NETWORKS, socialNetworkOf, type BrandAssetKind, type BrandProfile, type SocialNetwork } from "@kits/schema";
import { ImageIcon, UploadIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { imageAsDataUrl, MAX_IMAGE_BYTES } from "./brand-importer";

const KINDS = Object.keys(BRAND_ASSETS) as BrandAssetKind[];

/** Logo, favicon and images: detected from the website, pasted as a URL or uploaded (up to 200 KB). */
export function BrandAssetsField({ assets, onChange }: { assets: BrandProfile["assets"]; onChange: (assets: BrandProfile["assets"]) => void }) {
  return (
    <FieldSet>
      <FieldLegend variant="label">Logo and images</FieldLegend>
      <FieldDescription>Downloaded into every project (public/brand/). The favicon also replaces the framework&apos;s default one.</FieldDescription>
      <ul className="grid gap-3 sm:grid-cols-2">
        {KINDS.map((kind) => (
          <AssetSlot
            key={kind}
            kind={kind}
            value={assets[kind]}
            onChange={(value) => {
              const next = { ...assets };
              if (value) next[kind] = value;
              else delete next[kind];
              onChange(next);
            }}
          />
        ))}
      </ul>
    </FieldSet>
  );
}

function AssetSlot({ kind, value, onChange }: { kind: BrandAssetKind; value?: string; onChange: (value: string | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [broken, setBroken] = useState(false);
  const meta = BRAND_ASSETS[kind];
  const uploaded = value?.startsWith("data:");
  return (
    <li className="flex gap-3 rounded-lg border p-3">
      {/* Checkered-free neutral tile; dark logos get a dark tile so they stay visible. */}
      <div className={`grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border ${kind === "logoDark" ? "bg-foreground" : "bg-background"}`}>
        {value && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote brand assets from any host
          <img src={value} alt="" className="max-h-full max-w-full object-contain p-1.5" referrerPolicy="no-referrer" onError={() => setBroken(true)} onLoad={() => setBroken(false)} />
        ) : (
          <ImageIcon className="size-5 text-muted-foreground" />
        )}
      </div>
      <Field className="min-w-0 flex-1 gap-1.5">
        <FieldLabel htmlFor={`asset-${kind}`} className="text-xs">
          {meta.label} <span className="font-normal text-muted-foreground">· {meta.hint}</span>
        </FieldLabel>
        <div className="flex gap-1.5">
          <Input
            id={`asset-${kind}`}
            value={uploaded ? "Uploaded file" : (value ?? "")}
            readOnly={uploaded}
            onChange={(e) => {
              setBroken(false);
              onChange(e.target.value.trim() || undefined);
            }}
            placeholder="https://…"
            className="h-8 font-mono text-xs"
          />
          <Button type="button" variant="outline" size="icon-sm" aria-label={`Upload ${meta.label.toLowerCase()}`} onClick={() => input.current?.click()}>
            <UploadIcon />
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${meta.label.toLowerCase()}`} onClick={() => onChange(undefined)}>
              <XIcon />
            </Button>
          )}
        </div>
        {value && broken && <p className="text-xs text-destructive">This image doesn&apos;t load. Check the URL or upload the file.</p>}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,.ico"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const data = await imageAsDataUrl(file);
            if (!data) return void toast.error(`Use an image under ${MAX_IMAGE_BYTES / 1000} KB, or paste its URL`);
            setBroken(false);
            onChange(data);
          }}
        />
      </Field>
    </li>
  );
}

/** Website and social profiles: one URL per network, the network is recognized from the address. */
export function BrandLinksField({ website, social, onChange }: { website?: string; social: BrandProfile["social"]; onChange: (links: { website?: string; social: BrandProfile["social"] }) => void }) {
  const [draft, setDraft] = useState("");
  const entries = Object.entries(social) as [SocialNetwork, string][];
  const add = () => {
    const url = draft.trim();
    const network = socialNetworkOf(url);
    if (!network) return void toast.error(`Paste a profile URL from ${Object.values(SOCIAL_NETWORKS).map((n) => n.label).join(", ")}`);
    onChange({ website, social: { ...social, [network]: url } });
    setDraft("");
  };
  return (
    <FieldSet>
      <FieldLegend variant="label">Links</FieldLegend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="brand-website">Website</FieldLabel>
          <Input id="brand-website" value={website ?? ""} onChange={(e) => onChange({ website: e.target.value.trim() || undefined, social })} placeholder="https://acme.com" className="font-mono text-sm" />
        </Field>
        <Field>
          <FieldLabel htmlFor="brand-social">Add a social profile</FieldLabel>
          <div className="flex gap-1.5">
            <Input
              id="brand-social"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="https://linkedin.com/company/acme"
              className="font-mono text-sm"
            />
            <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()}>
              Add
            </Button>
          </div>
        </Field>
      </div>
      {entries.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border">
          {entries.map(([network, url]) => (
            <li key={network} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-20 shrink-0 font-medium">{SOCIAL_NETWORKS[network].label}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{url}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${SOCIAL_NETWORKS[network].label}`}
                onClick={() => {
                  const next = { ...social };
                  delete next[network];
                  onChange({ website, social: next });
                }}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </FieldSet>
  );
}
