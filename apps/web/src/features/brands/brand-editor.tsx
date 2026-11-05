"use client";

import { cliCommand, type BrandDetection, type BrandProfile } from "@kits/schema";
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
import { BrandImporter } from "./brand-importer";

type Colors = BrandProfile["colors"];
const COLOR_FIELDS: { key: keyof Colors; label: string; required?: boolean }[] = [
  { key: "primary", label: "Principal", required: true },
  { key: "primaryForeground", label: "Texto sobre principal" },
  { key: "background", label: "Fondo", required: true },
  { key: "foreground", label: "Texto", required: true },
  { key: "secondary", label: "Secundario" },
  { key: "accent", label: "Acento" },
  { key: "muted", label: "Fondos suaves" },
  { key: "border", label: "Bordes" },
  { key: "danger", label: "Error" },
];

const EMPTY: BrandProfile = {
  name: "",
  title: "",
  colors: { primary: "#111111", primaryForeground: "#ffffff", background: "#ffffff", foreground: "#111111", border: "#e5e5e5" },
  fonts: {},
  rules: [],
  docs: {},
};

/** Brand profile form with a live preview of the colors, fonts and radius. */
export function BrandEditor({ owners, initial, initialOwner }: { owners: string[]; initial?: BrandProfile; initialOwner?: string }) {
  const router = useRouter();
  const [owner, setOwner] = useState(initialOwner ?? owners[0] ?? "");
  const [p, setP] = useState<BrandProfile>(initial ?? EMPTY);
  const [rules, setRules] = useState((initial?.rules ?? []).join("\n"));
  const [guide, setGuide] = useState(initial?.docs["guia.md"] ?? "");
  const [pending, start] = useTransition();
  const editing = Boolean(initial);
  const set = <K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) => setP((prev) => ({ ...prev, [key]: value }));
  const setColor = (key: keyof Colors, value: string) => setP((prev) => ({ ...prev, colors: { ...prev.colors, [key]: value || undefined } }));
  const slug = `${owner}/${p.name || "nombre"}`;

  /** Merges a detection into the form: detected values win, everything else stays as typed. */
  const applyDetection = (d: BrandDetection) => {
    setP((prev) => {
      const title = prev.title || d.profile.title || "";
      return {
        ...prev,
        ...(d.profile.voice ? { voice: d.profile.voice } : {}),
        ...(d.profile.logo ? { logo: d.profile.logo } : {}),
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
    if (d.profile.docs?.["guia.md"]) setGuide(d.profile.docs["guia.md"]);
  };

  const submit = () =>
    start(async () => {
      const docs = { ...p.docs };
      if (guide.trim()) docs["guia.md"] = guide;
      else delete docs["guia.md"];
      const profile = { ...p, rules: rules.split("\n").map((r) => r.trim()).filter(Boolean), docs };
      const r = await saveBrandAction(owner, profile);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Perfil guardado");
      if (!editing) router.push(`/cuenta/marcas/${r.data}`);
    });

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-8">
      <BrandImporter onDetect={applyDetection} />
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
              <FieldLabel>Dueño</FieldLabel>
              <ToggleGroup variant="outline" size="sm" spacing={1} value={[owner]} onValueChange={(v: string[]) => v[0] && setOwner(v[0])} className="flex-wrap">
                {owners.map((o, i) => (
                  <ToggleGroupItem key={o} value={o} className="font-mono text-xs">
                    {o}
                    {i === 0 ? " (tú)" : ""}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldDescription>En una organización, todos sus miembros pueden usarlo.</FieldDescription>
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="brand-title">Nombre de la marca</FieldLabel>
              <Input id="brand-title" value={p.title} onChange={(e) => set("title", e.target.value)} placeholder="Acme" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="brand-name">Identificador</FieldLabel>
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
          <FieldLegend variant="label">Colores</FieldLegend>
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
                    placeholder={required ? "obligatorio" : "opcional"}
                    aria-label={`${label} en hex`}
                    className="w-20 bg-transparent font-mono text-xs text-muted-foreground outline-none"
                  />
                </div>
              </Field>
            ))}
          </div>
        </FieldSet>

        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="font-sans">Fuente de texto</FieldLabel>
              <Input id="font-sans" value={p.fonts.sans ?? ""} onChange={(e) => set("fonts", { ...p.fonts, sans: e.target.value || undefined })} placeholder="Inter" />
            </Field>
            <Field>
              <FieldLabel htmlFor="font-heading">Fuente de títulos</FieldLabel>
              <Input id="font-heading" value={p.fonts.heading ?? ""} onChange={(e) => set("fonts", { ...p.fonts, heading: e.target.value || undefined })} placeholder="igual que el texto" />
            </Field>
            <Field>
              <FieldLabel htmlFor="radius">Radio de esquinas</FieldLabel>
              <Input id="radius" value={p.radius ?? ""} onChange={(e) => set("radius", e.target.value || undefined)} placeholder="0.5rem" className="font-mono" />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="voice">Tono de los textos</FieldLabel>
            <Input id="voice" value={p.voice ?? ""} onChange={(e) => set("voice", e.target.value || undefined)} placeholder="Cercano y directo, de tú, sin tecnicismos" />
          </Field>
          <Field>
            <FieldLabel htmlFor="rules">Reglas de interfaz</FieldLabel>
            <Textarea id="rules" value={rules} onChange={(e) => setRules(e.target.value)} rows={4} placeholder={"Una por línea:\nBotones principales siempre en el color principal\nIconos de Lucide, nunca emojis"} />
          </Field>
          <Field>
            <FieldLabel htmlFor="guide">Guía de la empresa</FieldLabel>
            <Textarea id="guide" value={guide} onChange={(e) => setGuide(e.target.value)} rows={6} placeholder="Pega aquí la guía de estilo, el manual de marca o cualquier documentación (Markdown)." className="font-mono text-xs" />
            <FieldDescription>Se copia a docs/brand/guia.md en cada proyecto y el agente la lee antes de escribir interfaz.</FieldDescription>
          </Field>
        </FieldGroup>

        <Button type="submit" disabled={pending || !p.name || !p.title || !owner} className="self-start">
          {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear perfil"}
        </Button>
      </form>
      </div>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
        <div className="flex flex-col gap-2">
          <h2 className="label-mono">Vista previa</h2>
          <BrandPreview profile={p} />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="label-mono">Úsalo</h2>
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
      <p className="font-semibold" style={{ fontFamily: p.fonts.heading ? `"${p.fonts.heading}", ui-sans-serif` : font }}>
        {p.title || "Tu marca"}
      </p>
      <p className="text-sm opacity-80">Así se verán los botones, las tarjetas y el texto en tus proyectos.</p>
      <div className="flex flex-wrap gap-2">
        <span className="px-3 py-1.5 text-sm" style={{ background: c.primary, color: c.primaryForeground ?? c.background, borderRadius: radius }}>
          Principal
        </span>
        {c.secondary && (
          <span className="px-3 py-1.5 text-sm" style={{ background: c.secondary, color: c.foreground, borderRadius: radius }}>
            Secundario
          </span>
        )}
        <span className="border px-3 py-1.5 text-sm" style={{ borderColor: c.border ?? c.foreground, borderRadius: radius }}>
          Contorno
        </span>
      </div>
      {c.muted && (
        <div className="p-3 text-xs" style={{ background: c.muted, borderRadius: radius }}>
          Tarjeta con fondo suave
        </div>
      )}
      {c.danger && <p className="text-xs" style={{ color: c.danger }}>Mensaje de error</p>}
    </div>
  );
}
