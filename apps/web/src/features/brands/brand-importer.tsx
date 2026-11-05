"use client";

import { cliCommand, detectFromCss, detectFromJson, detectFromPixels, type BrandDetection } from "@kits/schema";
import { GlobeIcon, LoaderCircleIcon, UploadIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Command } from "@/components/shared/command";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { detectBrandFromUrlAction } from "./actions";

const ACCEPT = ".css,.scss,.json,.svg,.png,.jpg,.jpeg,.webp";

/** Reads one file in the browser: stylesheets and tokens as text, logos as pixels. */
async function detectFile(file: File): Promise<BrandDetection> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) return detectFromJson(JSON.parse(await file.text()));
  if (name.endsWith(".css") || name.endsWith(".scss")) return detectFromCss(await file.text());
  if (name.endsWith(".svg")) {
    // fill="#e11d48" / stroke=… / style="fill:…": the logo's colors, counted like CSS declarations.
    const svg = await file.text();
    const colors = svg.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)/g) ?? [];
    return detectFromCss(colors.map((c, i) => `.c${i} { color: ${c} }`).join("\n"));
  }
  if (file.type.startsWith("image/")) {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const size = 64; // plenty for a dominant color, and fast
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, size, size);
    return detectFromPixels(ctx.getImageData(0, 0, size, size).data);
  }
  throw new Error("Formato no soportado: usa CSS, JSON, SVG o una imagen");
}

/**
 * "Detectar la marca": from a website, a file (stylesheet, tokens, brand.json,
 * logo) or a project via the CLI. The result fills the form; nothing is saved
 * until the user reviews it.
 */
export function BrandImporter({ onDetect }: { onDetect: (d: BrandDetection) => void }) {
  const [url, setUrl] = useState("");
  const [found, setFound] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const apply = (d: BrandDetection, source: string) => {
    if (!Object.keys(d.profile.colors).length && !d.profile.title && !d.profile.fonts) {
      toast.error(`No se encontró ninguna marca en ${source}`);
      return;
    }
    onDetect(d);
    setFound(d.found);
    toast.success(`Marca detectada en ${source}: revisa los valores antes de guardar`);
  };

  const fromFile = (file: File | undefined) => {
    if (!file) return;
    start(async () => {
      try {
        apply(await detectFile(file), file.name);
      } catch (error) {
        toast.error((error as Error).message);
      }
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">Detectar la marca</h2>
        <p className="text-sm text-pretty text-muted-foreground">Rellena el perfil a partir de lo que ya existe; después solo revisas y ajustas.</p>
      </div>
      <Tabs defaultValue="web" className="gap-4">
        <TabsList variant="line" className="font-mono">
          <TabsTrigger value="web" className="text-xs">Desde una web</TabsTrigger>
          <TabsTrigger value="file" className="text-xs">Desde un archivo</TabsTrigger>
          <TabsTrigger value="project" className="text-xs">Desde tu proyecto</TabsTrigger>
        </TabsList>

        <TabsContent value="web">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await detectBrandFromUrlAction(url);
                if (r.ok) apply(r.data, url);
                else toast.error(r.error);
              });
            }}
          >
            <InputGroup>
              <InputGroupAddon>
                <GlobeIcon />
              </InputGroupAddon>
              <InputGroupInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="acme.com" aria-label="Dirección de la web" className="font-mono text-sm" />
              <InputGroupAddon align="inline-end">
                <InputGroupButton type="submit" variant="default" size="sm" disabled={pending || !url.trim()}>
                  {pending ? <LoaderCircleIcon className="animate-spin" /> : null}
                  Detectar
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <p className="mt-2 text-xs text-muted-foreground">Lee su color de tema, sus hojas de estilo (variables de color, fuentes, radio) y su nombre.</p>
          </form>
        </TabsContent>

        <TabsContent value="file">
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              fromFile(e.dataTransfer.files[0]);
            }}
            data-dragging={dragging}
            disabled={pending}
            className={cn(
              "flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors hover:bg-muted/40 data-[dragging=true]:border-foreground data-[dragging=true]:bg-muted/40",
            )}
          >
            {pending ? <LoaderCircleIcon className="size-5 animate-spin" /> : <UploadIcon className="size-5 text-muted-foreground" />}
            <span className="text-sm">Arrastra un archivo o haz clic para elegirlo</span>
            <span className="font-mono text-xs text-muted-foreground">globals.css · tokens .json · brand.json · logo (SVG, PNG, JPG)</span>
          </button>
          <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => fromFile(e.target.files?.[0] ?? undefined)} />
        </TabsContent>

        <TabsContent value="project" className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Dentro de un proyecto que ya tiene la marca (lee su hoja de estilos global y su nombre):</p>
          <Command command={cliCommand("brand detect")} />
          <p className="text-sm text-muted-foreground">
            Genera un <code className="font-mono">brand.json</code>. Úsalo directamente con <code className="font-mono">--brand ./brand.json</code> o súbelo en
            «Desde un archivo» para guardarlo aquí.
          </p>
          <p className="text-sm text-muted-foreground">
            ¿Prefieres que lo haga tu agente? Pídeselo con el skill <code className="font-mono">extract-design-system</code>.
          </p>
        </TabsContent>
      </Tabs>

      {found.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t pt-3">
          <p className="label-mono text-muted-foreground">Detectado</p>
          <ul className="flex flex-wrap gap-1.5 font-mono text-xs text-muted-foreground">
            {found.map((f) => (
              <li key={f} className="rounded-md bg-muted px-2 py-0.5">
                {f}
              </li>
            ))}
          </ul>
          <Button variant="link" size="sm" className="self-start px-0" onClick={() => setFound([])}>
            Ocultar
          </Button>
        </div>
      )}
    </section>
  );
}
