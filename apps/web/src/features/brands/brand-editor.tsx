"use client";

import { brandLogo, cliCommand, type BrandDetection, type BrandProfile } from "@kits/schema";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Command } from "@/components/shared/command";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { saveBrandAction } from "./actions";
import { BrandAssetsField, BrandLinksField } from "./brand-assets";
import { BrandImporter } from "./brand-importer";

type Colors = BrandProfile["colors"];
const COLOR_FIELDS: { key: keyof Colors; label: string; required?: boolean }[] = [
  { key: "primary", label: "Primary", required: true },
  { key: "primaryForeground", label: "Text on primary" },
  { key: "background", label: "Background", required: true },
  { key: "foreground", label: "Text", required: true },
  { key: "secondary", label: "Secondary" },
  { key: "accent", label: "Accent" },
  { key: "muted", label: "Soft backgrounds" },
  { key: "border", label: "Borders" },
  { key: "danger", label: "Error" },
];

const EMPTY: BrandProfile = {
  name: "",
  title: "",
  colors: { primary: "#111111", primaryForeground: "#ffffff", background: "#ffffff", foreground: "#111111", border: "#e5e5e5" },
  fonts: {},
  rules: [],
  docs: {},
  assets: {},
  social: {},
};

/** Brand profile form with a live preview of the colors, fonts and radius. */
/**
 * The full form. `initial` edits a saved profile; `draft` starts a new one prefilled (from the creator's
 * review step), without the importer, since the detection already happened.
 */
export function BrandEditor({ owners, initial, draft, initialOwner }: { owners: string[]; initial?: BrandProfile; draft?: BrandProfile; initialOwner?: string }) {
  const router = useRouter();
  const [owner, setOwner] = useState(initialOwner ?? owners[0] ?? "");
  // Profiles saved before `assets` existed keep their logo URL: it moves into the new field.
  const [p, setP] = useState<BrandProfile>(() => {
    const start = initial ?? draft ?? EMPTY;
    const logo = brandLogo(start);
    return { ...start, assets: { ...start.assets, ...(logo ? { logo } : {}) }, social: start.social ?? {}, logo: undefined };
  });
  const [rules, setRules] = useState(((initial ?? draft)?.rules ?? []).join("\n"));
  const [guide, setGuide] = useState((initial ?? draft)?.docs["guide.md"] ?? "");
  const [pending, start] = useTransition();
  const editing = Boolean(initial);
  const set = <K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) => setP((prev) => ({ ...prev, [key]: value }));
  const setColor = (key: keyof Colors, value: string) => setP((prev) => ({ ...prev, colors: { ...prev.colors, [key]: value || undefined } }));
  const slug = `${owner}/${p.name || "name"}`;

  /** Merges a detection into the form: detected values win, everything else stays as typed. */
  const applyDetection = (d: BrandDetection) => {
    setP((prev) => {
      const title = prev.title || d.profile.title || "";
      return {
        ...prev,
        ...(d.profile.voice ? { voice: d.profile.voice } : {}),
        // Detected images and links fill the gaps; what the person already set stays.
        assets: { ...d.profile.assets, ...prev.assets },
        social: { ...d.profile.social, ...prev.social },
        website: prev.website ?? d.profile.website,
        description: prev.description || d.profile.description,
        title,
        name: prev.name || (editing ? prev.name : title.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")),
        colors: { ...prev.colors, ...d.profile.colors },
        ...(d.profile.dark ? { dark: d.profile.dark } : {}),
        fonts: { ...prev.fonts, ...d.profile.fonts },
        radius: d.profile.radius ?? prev.radius,
        docs: { ...prev.docs, ...d.profile.docs },
      };
    });
    if (d.profile.rules?.length) setRules(d.profile.rules.join("\n"));
    if (d.profile.docs?.["guide.md"]) setGuide(d.profile.docs["guide.md"]);
  };

  const submit = () =>
    start(async () => {
      const docs = { ...p.docs };
      if (guide.trim()) docs["guide.md"] = guide;
      else delete docs["guide.md"];
      const profile = { ...p, rules: rules.split("\n").map((r) => r.trim()).filter(Boolean), docs };
      const r = await saveBrandAction(owner, profile);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Profile saved");
      if (!editing) router.push(`/brands/${r.data}`);
    });

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-8">
      {!draft && <BrandImporter onDetect={applyDetection} />}
      <form
        className="flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <FieldGroup>
          {owners.length > 1 && !editing && (
            <Field>
              <FieldLabel>Owner</FieldLabel>
              <ToggleGroup variant="outline" size="sm" spacing={1} value={[owner]} onValueChange={(v: string[]) => v[0] && setOwner(v[0])} className="flex-wrap">
                {owners.map((o, i) => (
                  <ToggleGroupItem key={o} value={o} className="font-mono text-xs">
                    {o}
                    {i === 0 ? " (you)" : ""}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldDescription>In an organization, all its members can use it.</FieldDescription>
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="brand-title">Brand name</FieldLabel>
              <Input id="brand-title" value={p.title} onChange={(e) => set("title", e.target.value)} placeholder="Acme" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="brand-name">Identifier</FieldLabel>
              <Input
                id="brand-name"
                value={p.name}
                onChange={(e) => set("name", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                placeholder="web"
                className="font-mono"
                disabled={editing}
                required
              />
            </Field>
          </div>
        </FieldGroup>

        <FieldSet>
          <FieldLegend variant="label">Colors</FieldLegend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {COLOR_FIELDS.map(({ key, label, required }) => (
              <Field key={key} orientation="horizontal" className="items-center gap-2">
                <input
                  type="color"
                  aria-label={label}
                  value={p.colors[key] ?? "#ffffff"}
                  onChange={(e) => setColor(key, e.target.value)}
                  className="size-8 shrink-0 cursor-pointer rounded-md border bg-transparent"
                />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-xs">{label}</span>
                  <input
                    value={p.colors[key] ?? ""}
                    onChange={(e) => setColor(key, e.target.value)}
                    placeholder={required ? "required" : "optional"}
                    aria-label={`${label} in hex`}
                    className="w-20 bg-transparent font-mono text-xs text-muted-foreground outline-none"
                  />
                </div>
              </Field>
            ))}
          </div>
        </FieldSet>

        <BrandAssetsField assets={p.assets} onChange={(assets) => set("assets", assets)} />

        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="font-sans">Body font</FieldLabel>
              <Input id="font-sans" value={p.fonts.sans ?? ""} onChange={(e) => set("fonts", { ...p.fonts, sans: e.target.value || undefined })} placeholder="Inter" />
            </Field>
            <Field>
              <FieldLabel htmlFor="font-heading">Heading font</FieldLabel>
              <Input id="font-heading" value={p.fonts.heading ?? ""} onChange={(e) => set("fonts", { ...p.fonts, heading: e.target.value || undefined })} placeholder="same as body" />
            </Field>
            <Field>
              <FieldLabel htmlFor="radius">Corner radius</FieldLabel>
              <Input id="radius" value={p.radius ?? ""} onChange={(e) => set("radius", e.target.value || undefined)} placeholder="0.5rem" className="font-mono" />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="voice">Voice and tone</FieldLabel>
            <Input id="voice" value={p.voice ?? ""} onChange={(e) => set("voice", e.target.value || undefined)} placeholder="Friendly and direct, no jargon" />
          </Field>
          <Field>
            <FieldLabel htmlFor="rules">Interface rules</FieldLabel>
            <Textarea id="rules" value={rules} onChange={(e) => setRules(e.target.value)} rows={4} placeholder={"One per line:\nPrimary buttons always use the primary color\nLucide icons, never emojis"} />
          </Field>
          <Field>
            <FieldLabel htmlFor="guide">Company guide</FieldLabel>
            <Textarea id="guide" value={guide} onChange={(e) => setGuide(e.target.value)} rows={6} placeholder="Paste the style guide, brand manual or any documentation here (Markdown)." className="font-mono text-xs" />
            <FieldDescription>Copied to docs/brand/guide.md in every project; the agent reads it before writing any interface.</FieldDescription>
          </Field>
        </FieldGroup>

        <BrandLinksField website={p.website} social={p.social} onChange={({ website, social }) => setP((prev) => ({ ...prev, website, social }))} />

        <Button type="submit" disabled={pending || !p.name || !p.title || !owner} className="self-start">
          {pending ? "Saving…" : editing ? "Save changes" : "Create profile"}
        </Button>
      </form>
      </div>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
        <div className="flex flex-col gap-2">
          <h2 className="label-mono">Preview</h2>
          <BrandPreview profile={p} />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="label-mono">Use it</h2>
          <Command command={cliCommand(`landing-next --brand ${slug}`)} wrap />
          <Command command={cliCommand(`brand ${slug}`)} wrap />
        </div>
      </aside>
    </div>
  );
}

/** The brand's own colors, so the inline styles are the point here, not raw colors in the site's UI. */
export function BrandPreview({ profile: p }: { profile: BrandProfile }) {
  const c = p.colors;
  const radius = p.radius ?? "0.5rem";
  const font = p.fonts.sans ? `"${p.fonts.sans}", ui-sans-serif, system-ui` : undefined;
  return (
    <div className="flex flex-col gap-3 border p-4" style={{ background: c.background, color: c.foreground, borderRadius: radius, borderColor: c.border, fontFamily: font }}>
      <div className="flex items-center gap-2.5">
        {(p.assets?.icon ?? brandLogo(p)) && (
          // eslint-disable-next-line @next/next/no-img-element -- remote brand assets from any host
          <img src={p.assets?.icon ?? brandLogo(p)} alt="" className="size-6 shrink-0 object-contain" referrerPolicy="no-referrer" />
        )}
        <p className="font-semibold" style={{ fontFamily: p.fonts.heading ? `"${p.fonts.heading}", ui-sans-serif` : font }}>
          {p.title || "Your brand"}
        </p>
      </div>
      <p className="text-sm opacity-80">This is how buttons, cards and text will look in your projects.</p>
      <div className="flex flex-wrap gap-2">
        <span className="px-3 py-1.5 text-sm" style={{ background: c.primary, color: c.primaryForeground ?? c.background, borderRadius: radius }}>
          Primary
        </span>
        {c.secondary && (
          <span className="px-3 py-1.5 text-sm" style={{ background: c.secondary, color: c.foreground, borderRadius: radius }}>
            Secondary
          </span>
        )}
        <span className="border px-3 py-1.5 text-sm" style={{ borderColor: c.border ?? c.foreground, borderRadius: radius }}>
          Outline
        </span>
      </div>
      {c.muted && (
        <div className="p-3 text-xs" style={{ background: c.muted, borderRadius: radius }}>
          Card with a soft background
        </div>
      )}
      {c.danger && <p className="text-xs" style={{ color: c.danger }}>Error message</p>}
    </div>
  );
}
