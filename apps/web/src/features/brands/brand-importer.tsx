"use client";

import { cliCommand, detectFromCss, detectFromJson, detectFromPixels, isEmptyDetection, svgColors, type BrandDetection } from "@kits/schema";
import { GlobeIcon, LoaderCircleIcon, UploadIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Command } from "@/components/shared/command";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { detectBrandFromUrlAction } from "./actions";

export const ACCEPT = ".css,.scss,.json,.svg,.png,.jpg,.jpeg,.webp";

/** A small image as a data: URL, so an uploaded logo can be stored in the profile itself. */
export async function imageAsDataUrl(file: File, maxBytes = MAX_IMAGE_BYTES): Promise<string | null> {
  if (!file.type.startsWith("image/") || file.size > maxBytes) return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
export const MAX_IMAGE_BYTES = 200_000;

/** Adds the uploaded logo itself to a detection made from its colors. */
async function withLogo(file: File, d: BrandDetection): Promise<BrandDetection> {
  const logo = await imageAsDataUrl(file);
  return logo ? { profile: { ...d.profile, assets: { ...d.profile.assets, logo } }, found: [...d.found, "logo: the uploaded file"] } : d;
}

/** Reads one file in the browser: stylesheets and tokens as text, logos as pixels. */
export async function detectFile(file: File): Promise<BrandDetection> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) return detectFromJson(JSON.parse(await file.text()));
  if (name.endsWith(".css") || name.endsWith(".scss")) return detectFromCss(await file.text());
  if (name.endsWith(".svg")) {
    // fill="#e11d48" / stroke=… / style="fill:…": the logo's colors, counted like CSS declarations.
    const colors = svgColors(await file.text());
    return withLogo(file, detectFromCss(colors.map((c, i) => `.c${i} { color: ${c} }`).join("\n")));
  }
  if (file.type.startsWith("image/")) {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const size = 64; // plenty for a dominant color, and fast
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, size, size);
    return withLogo(file, detectFromPixels(ctx.getImageData(0, 0, size, size).data));
  }
  throw new Error("Unsupported format: use CSS, JSON, SVG or an image");
}

/**
 * "Detect the brand": from a website, a file (stylesheet, tokens, brand.json,
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
    if (isEmptyDetection(d)) {
      toast.error(`No brand found in ${source}`);
      return;
    }
    onDetect(d);
    setFound(d.found);
    toast.success(`Brand detected in ${source}: review the values before saving`);
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
        <h2 className="font-semibold">Detect the brand</h2>
        <p className="text-sm text-pretty text-muted-foreground">Fills in the profile from what already exists; then you just review and adjust.</p>
      </div>
      <Tabs defaultValue="web" className="gap-4">
        <TabsList variant="line" className="font-mono">
          <TabsTrigger value="web" className="text-xs">From a website</TabsTrigger>
          <TabsTrigger value="file" className="text-xs">From a file</TabsTrigger>
          <TabsTrigger value="project" className="text-xs">From your project</TabsTrigger>
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
            <InputGroup className="h-10">
              <InputGroupAddon>
                <GlobeIcon />
              </InputGroupAddon>
              <InputGroupInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="acme.com" aria-label="Website address" className="font-mono text-sm" />
              <InputGroupAddon align="inline-end">
                <InputGroupButton type="submit" variant="default" size="attached" disabled={pending || !url.trim()}>
                  {pending ? <LoaderCircleIcon className="animate-spin" /> : null}
                  Detect
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <p className="mt-2 text-xs text-muted-foreground">Reads its theme color, its stylesheets (color variables, fonts, radius) and its name.</p>
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
            <span className="text-sm">Drop a file or click to choose one</span>
            <span className="font-mono text-xs text-muted-foreground">globals.css · tokens .json · brand.json · logo (SVG, PNG, JPG)</span>
          </button>
          <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => fromFile(e.target.files?.[0] ?? undefined)} />
        </TabsContent>

        <TabsContent value="project" className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Inside a project that already has the brand (it reads its global stylesheet and its name):</p>
          <Command command={cliCommand("brand detect")} />
          <p className="text-sm text-muted-foreground">
            It generates a <code className="font-mono">brand.json</code>. Use it directly with <code className="font-mono">--brand ./brand.json</code> or upload it in
            &quot;From a file&quot; to save it here.
          </p>
          <p className="text-sm text-muted-foreground">
            Rather have your agent do it? Ask it to, with the <code className="font-mono">extract-design-system</code> skill.
          </p>
        </TabsContent>
      </Tabs>

      {found.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t pt-3">
          <p className="label-mono text-muted-foreground">Detected</p>
          <ul className="flex flex-wrap gap-1.5 font-mono text-xs text-muted-foreground">
            {found.map((f) => (
              <li key={f} className="rounded-md bg-muted px-2 py-0.5">
                {f}
              </li>
            ))}
          </ul>
          <Button variant="link" size="sm" className="self-start px-0" onClick={() => setFound([])}>
            Hide
          </Button>
        </div>
      )}
    </section>
  );
}
