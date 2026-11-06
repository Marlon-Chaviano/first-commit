"use client";

import {
  BRAND_ASSETS,
  brandSlug,
  emptyBrandProfile,
  finishBrand,
  readableOn,
  SOCIAL_NETWORKS,
  type BrandDetection,
  type BrandProfile,
  type Candidate,
  type SocialNetwork,
} from "@kits/schema";
import { ArrowLeftIcon, CheckIcon, GlobeIcon, LoaderCircleIcon, PencilIcon, SparklesIcon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import { detectBrandFromUrlAction, saveBrandAction } from "./actions";
import { BrandEditor, BrandPreview } from "./brand-editor";
import { ACCEPT, detectFile, imageAsDataUrl, MAX_IMAGE_BYTES } from "./brand-importer";

type Review = { detection: BrandDetection; source: string };
type Step = { kind: "start" } | { kind: "review" } | { kind: "edit"; draft: BrandProfile; from: "review" | "start" };


/** What the server reads while detecting, shown in turn so the wait explains itself. */
const STAGES = ["Reading the page", "Loading its stylesheets", "Checking the logo and icons", "Weighing the colors"];

/**
 * Creating a brand profile in three steps: start from a website (or a file, or nothing),
 * review what was detected choosing between alternatives, and only then the full form, if wanted.
 */
export function BrandCreator({ owners }: { owners: string[] }) {
  const [step, setStep] = useState<Step>({ kind: "start" });
  const [review, setReview] = useState<Review | null>(null);
  // Each step starts at its top, not wherever the previous one was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step.kind]);
  const restart = () => {
    setReview(null);
    setStep({ kind: "start" });
  };
  return (
    <>
      {step.kind === "start" && (
        <Start
          onDetected={(detection, source) => {
            setReview({ detection, source });
            setStep({ kind: "review" });
          }}
          onBlank={() => setStep({ kind: "edit", draft: blank(), from: "start" })}
        />
      )}
      {/* Hidden, not unmounted, while fine-tuning: "Back to the review" finds every choice where it was. */}
      {review && (
        <div hidden={step.kind !== "review"}>
          <ReviewStep key={review.source} detection={review.detection} source={review.source} owners={owners} onBack={restart} onEdit={(draft) => setStep({ kind: "edit", draft, from: "review" })} />
        </div>
      )}
      {step.kind === "edit" && (
        <div className="flex flex-col gap-6">
          {step.from === "review" ? (
            <BackButton onClick={() => setStep({ kind: "review" })}>Back to the review</BackButton>
          ) : (
            <BackButton onClick={restart}>Back</BackButton>
          )}
          <BrandEditor owners={owners} draft={step.draft} />
        </div>
      )}
    </>
  );
}

const blank = emptyBrandProfile;

// ── Step 1: start ────────────────────────────────────────────────────────────

function Start({ onDetected, onBlank }: { onDetected: (d: BrandDetection, source: string) => void; onBlank: () => void }) {
  const [url, setUrl] = useState("");
  const [pending, start] = useTransition();
  const [stage, setStage] = useState(0);
  const [dragging, setDragging] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 1800);
    return () => clearInterval(timer);
  }, [pending]);

  const fromFile = (f: File | undefined) => {
    if (!f) return;
    setStage(0);
    start(async () => {
      try {
        const d = await detectFile(f);
        if (!Object.keys(d.profile.colors).length && !d.profile.assets) return void toast.error(`Nothing found in ${f.name}`);
        onDetected(d, f.name);
      } catch (error) {
        toast.error((error as Error).message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-5 rounded-xl border p-6 sm:p-8">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-lg font-semibold tracking-tight">Start from the website</h3>
          <p className="text-sm text-pretty text-muted-foreground">
            We read its logo, favicon, colors, fonts and social profiles. You review everything before saving.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStage(0);
            start(async () => {
              const r = await detectBrandFromUrlAction(url);
              if (r.ok) onDetected(r.data, url.trim());
              else toast.error(r.error);
            });
          }}
        >
          <InputGroup className="h-12">
            <InputGroupAddon>
              <GlobeIcon />
            </InputGroupAddon>
            <InputGroupInput
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="acme.com"
              aria-label="Website address"
              autoFocus
              disabled={pending}
              className="font-mono text-base"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton type="submit" variant="default" size="attached" disabled={pending || !url.trim()} className="px-5">
                {pending ? <LoaderCircleIcon className="animate-spin" /> : <SparklesIcon />}
                Detect
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
        {pending && (
          <ol className="flex flex-col gap-1.5 text-sm" aria-live="polite">
            {STAGES.map((label, i) => (
              <li key={label} className={cn("flex items-center gap-2 transition-colors", i <= stage ? "text-foreground" : "text-muted-foreground/60")}>
                {i < stage ? <CheckIcon className="size-3.5" /> : i === stage ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <span className="size-3.5" />}
                {label}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => file.current?.click()}
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
          className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-5 text-left transition-colors hover:bg-muted/40 data-[dragging=true]:border-foreground data-[dragging=true]:bg-muted/40"
        >
          <UploadIcon className="size-5" />
          <span className="font-medium">Upload a logo or a file</span>
          <span className="text-sm text-pretty text-muted-foreground">A logo (its colors and the file itself), globals.css, design tokens or a brand.json.</span>
        </button>
        <input ref={file} type="file" accept={ACCEPT} className="hidden" onChange={(e) => fromFile(e.target.files?.[0])} />
        <button type="button" disabled={pending} onClick={onBlank} className="flex flex-col items-start gap-2 rounded-xl border p-5 text-left transition-colors hover:bg-muted/40">
          <PencilIcon className="size-5" />
          <span className="font-medium">Start from scratch</span>
          <span className="text-sm text-pretty text-muted-foreground">Fill in colors, fonts, logo and rules yourself.</span>
        </button>
      </div>
    </div>
  );
}

// ── Step 2: review ───────────────────────────────────────────────────────────

function ReviewStep({
  detection,
  source,
  owners,
  onBack,
  onEdit,
}: {
  detection: BrandDetection;
  source: string;
  owners: string[];
  onBack: () => void;
  onEdit: (draft: BrandProfile) => void;
}) {
  const router = useRouter();
  const d = detection.profile;
  const c = detection.candidates;
  const [owner, setOwner] = useState(owners[0] ?? "");
  const [title, setTitle] = useState(d.title ?? "");
  const [name, setName] = useState(brandSlug(d.title ?? ""));
  const [nameEdited, setNameEdited] = useState(false);
  const [logo, setLogo] = useState(d.assets?.logo ?? d.logo);
  const [icon, setIcon] = useState(d.assets?.icon);
  const [primary, setPrimary] = useState(d.colors.primary ?? "#0a0a0a");
  const [background, setBackground] = useState(d.colors.background ?? "#ffffff");
  const [foreground, setForeground] = useState(d.colors.foreground ?? (d.colors.background && readableOn(d.colors.background) === "#ffffff" ? "#fafafa" : "#0a0a0a"));
  const [sans, setSans] = useState(d.fonts?.sans ?? "");
  const [heading, setHeading] = useState(d.fonts?.heading ?? "");
  const [pending, start] = useTransition();

  const logos = withCurrent(c?.logo ?? [], logo, "the uploaded file");
  const icons = withCurrent(c?.icon ?? [], icon, "the site");
  const primaries = withCurrent(c?.primary ?? [], d.colors.primary, "the detection").slice(0, 6);
  const fonts = [...new Set([d.fonts?.sans, d.fonts?.heading, ...(c?.fonts ?? []).map((f) => f.value)].filter(Boolean) as string[])];

  // The person's picks on top of the detection, finished by the shared rule (defaults, slug, text color).
  const profile = (): BrandProfile =>
    finishBrand(
      {
        ...d,
        colors: { ...d.colors, primary, primaryForeground: readableOn(primary), background, foreground },
        fonts: { ...d.fonts, sans: sans || undefined, heading: heading || undefined },
        assets: { ...d.assets, logo: logo || undefined, icon: icon || undefined },
      },
      { name, title },
    );

  const also = [
    d.description && "description",
    d.assets?.ogImage && "social image",
    d.assets?.appleTouchIcon && "app icon",
    d.radius && `radius ${d.radius}`,
    d.dark && "dark palette",
    Object.keys(d.social ?? {}).length && `${Object.keys(d.social ?? {}).map((n) => SOCIAL_NETWORKS[n as SocialNetwork].label).join(", ")}`,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-6">
      <BackButton onClick={onBack}>Try another website or file</BackButton>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form
          className="flex flex-col gap-8"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              let p: BrandProfile;
              try {
                p = profile();
              } catch {
                return void toast.error("Check the name: lowercase letters, numbers and hyphens");
              }
              const r = await saveBrandAction(owner, p);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Brand profile created");
              router.push(`/brands/${r.data}`);
            });
          }}
        >
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold tracking-tight">Review what we found</h3>
            <p className="text-sm text-muted-foreground">
              From <span className="font-mono text-foreground">{source}</span>. Pick the right option where there are several.
            </p>
          </div>

          <Section title="Name">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="review-title">Brand name</FieldLabel>
                <Input
                  id="review-title"
                  value={title}
                  required
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!nameEdited) setName(brandSlug(e.target.value));
                  }}
                  placeholder="Acme"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="review-name">Identifier</FieldLabel>
                <Input
                  id="review-name"
                  value={name}
                  required
                  onChange={(e) => {
                    setNameEdited(true);
                    setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                  }}
                  className="font-mono"
                />
                <FieldDescription className="font-mono">--brand {owner}/{name || "name"}</FieldDescription>
              </Field>
            </div>
            {owners.length > 1 && (
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
              </Field>
            )}
          </Section>

          <Section title="Logo" hint={logos.length > 1 ? "Several candidates: pick the real one." : undefined}>
            <ImageChoices options={logos} value={logo} onChange={setLogo} label="logo" />
          </Section>

          <Section title={BRAND_ASSETS.icon.label}>
            <ImageChoices options={icons} value={icon} onChange={setIcon} label="favicon" small />
          </Section>

          <Section
            title="Main color"
            hint={detection.primaryConfident === false ? "We aren't sure about this one: pick the color that represents the brand." : "Buttons, links and highlights use it."}
            attention={detection.primaryConfident === false}
          >
            <div className="flex flex-wrap items-start gap-3">
              {primaries.map((cand) => (
                <Swatch key={cand.value} color={cand.value} caption={cand.source} selected={cand.value === primary} onClick={() => setPrimary(cand.value)} />
              ))}
              <label className="flex w-20 cursor-pointer flex-col items-center gap-1.5 text-center">
                <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="size-12 cursor-pointer rounded-full border bg-transparent" aria-label="Custom main color" />
                <span className="text-xs text-muted-foreground">Custom</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-6 pt-2 text-sm">
              <ColorInput label="Background" value={background} onChange={setBackground} />
              <ColorInput label="Text" value={foreground} onChange={setForeground} />
            </div>
          </Section>

          <Section title="Fonts">
            <datalist id="review-fonts">
              {fonts.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="review-sans">Body</FieldLabel>
                <Input id="review-sans" list="review-fonts" value={sans} onChange={(e) => setSans(e.target.value)} placeholder="Inter" />
              </Field>
              <Field>
                <FieldLabel htmlFor="review-heading">Headings</FieldLabel>
                <Input id="review-heading" list="review-fonts" value={heading} onChange={(e) => setHeading(e.target.value)} placeholder="Same as body" />
              </Field>
            </div>
          </Section>

          {also.length > 0 && (
            <p className="text-sm text-pretty text-muted-foreground">
              <span className="text-foreground">Also saved:</span> {also.join(" · ")}.
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:items-center">
            <Button type="submit" disabled={pending || !name || !title || !owner}>
              {pending && <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />}
              Create brand profile
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                try {
                  onEdit(profile());
                } catch {
                  toast.error("Check the name: lowercase letters, numbers and hyphens");
                }
              }}
            >
              Fine-tune everything
            </Button>
            <span className="text-xs text-muted-foreground sm:ml-auto">Rules, voice, dark palette and docs are in &quot;Fine-tune&quot;.</span>
          </div>
        </form>

        <aside className="flex flex-col gap-2 lg:sticky lg:top-20 lg:self-start">
          <h3 className="label-mono">Preview</h3>
          <BrandPreview
            profile={{
              ...blank(),
              title: title || "Your brand",
              colors: { ...d.colors, primary, primaryForeground: readableOn(primary), background, foreground },
              fonts: { sans: sans || undefined, heading: heading || undefined },
              radius: d.radius,
              assets: { icon, logo },
            }}
          />
          {logo && (
            <div className="grid h-24 place-items-center rounded-lg border p-4" style={{ background }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- remote brand logo from any host */}
              <img src={logo} alt="" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/** The detected options, plus the current value if it came from elsewhere (an upload). */
function withCurrent(options: Candidate[], current: string | undefined, source: string): Candidate[] {
  return current && !options.some((o) => o.value === current) ? [{ value: current, source }, ...options] : options;
}

function Section({ title, hint, attention, children }: { title: string; hint?: string; attention?: boolean; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h4 className="label-mono">{title}</h4>
        {hint && <p className={cn("text-sm", attention ? "font-medium text-foreground" : "text-muted-foreground")}>{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function ImageChoices({ options, value, onChange, label, small }: { options: Candidate[]; value?: string; onChange: (v: string | undefined) => void; label: string; small?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const tile = small ? "h-24 w-24" : "h-28 w-40";
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-3">
      {options.map((o) => (
        <ImageTile key={o.value} option={o} selected={o.value === value} onSelect={() => onChange(o.value)} className={tile} />
      ))}
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={cn("flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground", tile)}
      >
        <UploadIcon className="size-4" />
        Upload
      </button>
      {value && (
        <button type="button" onClick={() => onChange(undefined)} className={cn("flex items-center justify-center rounded-lg border text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground", tile)}>
          None
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,.ico"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const data = await imageAsDataUrl(f);
          if (!data) return void toast.error(`Use an image under ${MAX_IMAGE_BYTES / 1000} KB`);
          onChange(data);
        }}
      />
    </div>
  );
}

function ImageTile({ option, selected, onSelect, className }: { option: Candidate; selected: boolean; onSelect: () => void; className: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      title={`From ${option.source}`}
      onClick={onSelect}
      className={cn(
        "group relative flex shrink-0 flex-col overflow-hidden rounded-lg border transition-shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected ? "ring-2 ring-foreground" : "hover:ring-1 hover:ring-foreground/30",
        className,
      )}
    >
      {/* White area: logos are drawn for light backgrounds. The image is the brand's, not the site's palette. */}
      <span className="relative min-h-0 flex-1 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote brand assets from any host */}
        <img src={option.value} alt="" className="absolute inset-0 size-full object-contain p-3" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      </span>
      {selected && (
        <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-black text-white">
          <CheckIcon className="size-3" />
        </span>
      )}
      <span className="shrink-0 truncate border-t bg-background px-2 py-1 text-left text-[11px] text-muted-foreground">{option.source}</span>
    </button>
  );
}

function Swatch({ color, caption, selected, onClick }: { color: string; caption: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onClick} className="flex w-20 flex-col items-center gap-1.5 text-center outline-none">
      {/* The swatch is the brand's color: data, not part of the site's palette. */}
      <span
        className={cn("grid size-12 place-items-center rounded-full border transition-shadow", selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "hover:ring-1 hover:ring-foreground/30")}
        style={{ background: color, color: readableOn(color) }}
      >
        {selected && <CheckIcon className="size-4" />}
      </span>
      <span className="font-mono text-[11px]">{color}</span>
      <span className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">{caption}</span>
    </button>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-7 cursor-pointer rounded-md border bg-transparent" aria-label={label} />
      <span className="flex flex-col">
        <span className="text-xs">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
      </span>
    </label>
  );
}

function BackButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeftIcon className="size-3.5" />
      {children}
    </button>
  );
}

