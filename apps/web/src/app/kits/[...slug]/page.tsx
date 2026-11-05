import { allKitSkills, BRAND, kitLanguage, LANGUAGES, defaultSelections, pruneSelections, validateSelections, type Selections } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheckIcon, LockIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense, type ComponentProps } from "react";

import { CopyButton } from "@/components/shared/copy-button";
import { TechIcon } from "@/components/shared/tech-icon";
import { Sparkline } from "@/components/shared/sparkline";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Configurator } from "@/features/kits/configurator";
import { ReportDialog } from "@/features/kits/report-dialog";
import { BuyKitButton } from "@/features/billing/buttons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { readRecommendation } from "@/features/recommend/href";
import { CATEGORIES } from "@/lib/categories";
import { formatCount } from "@/lib/format";
import { getKitStats } from "@/server/metrics/queries";
import { canReadKit } from "@/server/orgs";
import { findCommunityVersion, getIndex, getKitPage } from "@/server/registry";
import { hasLicense } from "@/server/billing";
import { env } from "@/server/env";
import { billingEnabled } from "@/server/stripe";
import { getViewer } from "@/server/session";
import { getVerification } from "@/server/verifications/queries";
import { getSkillAudits } from "@/server/audits";

// Official kits are prerendered; community kits ("ana/landing") render on first visit.
export async function generateStaticParams() {
  return (await getIndex()).map((k) => ({ slug: [k.name] }));
}

export async function generateMetadata({ params }: PageProps<"/kits/[...slug]">): Promise<Metadata> {
  const page = await getKitPage((await params).slug.join("/"));
  // Private kits: no title or description in metadata (it's rendered before the membership check).
  if (!page || page.meta.visibility !== "public") return { robots: { index: false } };
  return { title: page.meta.slug, description: page.kit.description };
}

export default function KitPage({ params, searchParams }: PageProps<"/kits/[...slug]">) {
  // Community slugs aren't known at build time, so their params are request data.
  return (
    <Suspense fallback={<KitSkeleton />}>
      <KitContent slug={params.then((p) => p.slug.join("/"))} searchParams={searchParams} />
    </Suspense>
  );
}

async function RecommendedConfigurator({
  searchParams,
  ...props
}: { searchParams: PageProps<"/kits/[...slug]">["searchParams"] } & Omit<ComponentProps<typeof Configurator>, "initial" | "reasons">) {
  const { options, reasons } = readRecommendation(await searchParams);
  if (!Object.keys(options).length) return <Configurator {...props} />;
  const defaults = defaultSelections(props.kit);
  const known = Object.fromEntries(Object.entries(options).filter(([id]) => props.kit.options.some((o) => o.id === id)));
  let initial: Selections = defaults;
  try {
    initial = pruneSelections(props.kit, { ...defaults, options: { ...defaults.options, ...known } });
    validateSelections(props.kit, initial);
  } catch {
    initial = defaults; // A hand-edited URL that isn't a valid combination: show the defaults.
  }
  return <Configurator {...props} initial={initial} reasons={reasons} />;
}

function KitSkeleton() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pt-8 sm:px-6 sm:pt-12">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-6 w-full max-w-2xl" />
      <Skeleton className="mt-8 h-96" />
    </div>
  );
}

async function KitContent({ slug, searchParams }: { slug: Promise<string>; searchParams: PageProps<"/kits/[...slug]">["searchParams"] }) {
  const page = await getKitPage(await slug);
  if (!page) notFound();
  const viewer = await getViewer();
  if (page.meta.visibility !== "public" && !(await canReadKit({ visibility: page.meta.visibility, orgId: page.meta.orgId ?? null }, viewer))) notFound();
  const { kit, meta } = page;
  const premium = await premiumState(meta, viewer);
  const [stats, verification, audits] = await Promise.all([
    getKitStats(meta.slug),
    getVerification(meta.slug, meta.version),
    getSkillAudits(allKitSkills(kit)),
  ]);

  const languageLabel = LANGUAGES.find((l) => l.id === kitLanguage(kit))?.label ?? "";
  // Details for the sticky column next to the install command.
  const details = (
    <section className="flex flex-col gap-4 rounded-xl border p-4 text-sm">
      <h2 className="font-semibold">Detalles</h2>
      <dl className="flex flex-col gap-3">
        <Row label="Autor">
          {meta.owner ? (
            <Link href={`/u/${meta.owner.handle}`} className="font-mono hover:underline">{meta.owner.handle}</Link>
          ) : (
            <span className="font-mono">{kit.author}</span>
          )}
        </Row>
        {meta.repo && !meta.official && (
          <Row label="Origen">
            <a href={`https://github.com/${meta.repo}`} className="font-mono break-all hover:underline">
              {meta.repo}
              {meta.path ? `/${meta.path}` : ""}
            </a>
          </Row>
        )}
        <Row label="Verificación">
          {verification.verified ? (
            <span className="flex items-center gap-1.5"><BadgeCheckIcon className="size-4" /> Verificado</span>
          ) : (
            <span className="text-muted-foreground">{verification.platforms.length ? "Falló la última prueba" : `Sin verificar · ${BRAND.cli} test en CI`}</span>
          )}
        </Row>
        {verification.platforms.length > 0 && (
          <Row label="Plataformas">
            <span className="font-mono text-xs text-muted-foreground">
              {verification.platforms.map((p) => `${p.ok ? "✓" : "✗"} ${PLATFORMS[p.platform] ?? p.platform}`).join(" · ")}
            </span>
          </Row>
        )}
        <Row label="Insignia">
          <span className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- an SVG badge, same as in a README */}
            <img src={`/badge/${meta.slug}.svg`} alt={`${BRAND.name}: instalaciones de ${meta.slug}`} height={20} className="h-5 w-fit" />
            <CopyButton text={`[![${BRAND.name}](${BRAND.siteUrl}/badge/${meta.slug}.svg)](${BRAND.siteUrl}/kits/${meta.slug})`} label="Copiar Markdown de la insignia" />
          </span>
        </Row>
      </dl>
      <ReportDialog kit={meta.slug} />
    </section>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/#leaderboard" />}>kits</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{meta.slug}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="grid size-16 shrink-0 place-items-center rounded-2xl border bg-muted/40">
          <TechIcon id={kitLanguage(kit)} label={languageLabel} className="size-8" />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{kit.title}</h1>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">{meta.official ? "Oficial" : "Comunidad"}</Badge>
              {verification.verified && (
                <Badge variant="outline" className="gap-1">
                  <BadgeCheckIcon className="size-3" /> Verificado
                </Badge>
              )}
              <Badge variant="outline" className="font-mono">v{kit.version}</Badge>
            </div>
          </div>
          <p className="font-mono text-sm text-muted-foreground">{meta.slug}</p>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{kit.description}</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {kit.tags.map((t) => (
              <Badge key={t} variant="secondary" className="font-mono font-normal">{t}</Badge>
            ))}
          </div>
        </div>
      </header>

      <dl className="mt-8 grid grid-cols-2 overflow-hidden rounded-xl border sm:grid-cols-4 [&>div]:border-border [&>div:nth-child(2n)]:border-l sm:[&>div]:border-l sm:[&>div:first-child]:border-l-0 [&>div:nth-child(n+3)]:border-t sm:[&>div:nth-child(n+3)]:border-t-0">
        <StatCell label="Instalaciones">
          <span className="flex items-end justify-between gap-3">
            <span className="font-mono text-2xl font-semibold tabular-nums">{formatCount(stats.installs)}</span>
            <Sparkline values={stats.weekly} className="h-7 w-20" />
          </span>
        </StatCell>
        <StatCell label="Personas">
          <span className="font-mono text-2xl font-semibold tabular-nums">{formatCount(stats.unique)}</span>
        </StatCell>
        <StatCell label="Skills">
          <span className="font-mono text-2xl font-semibold tabular-nums">{allKitSkills(kit).length}</span>
        </StatCell>
        <StatCell label={CATEGORIES[kit.category] ?? kit.category}>
          <span className="flex items-center gap-2 text-lg font-medium">
            <TechIcon id={kitLanguage(kit)} label={languageLabel} className="size-5" />
            {languageLabel}
          </span>
        </StatCell>
      </dl>

      {premium && (
        <Alert className="mt-6">
          <LockIcon />
          <AlertTitle>
            Kit de pago · {formatPrice(premium.priceCents)}
            {premium.licensed && " · ya es tuyo"}
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            {premium.licensed ? (
              <p>Instálalo con el comando de abajo tras iniciar sesión en el CLI ({`${BRAND.cli} login`}).</p>
            ) : (
              <>
                <p>Pago único: incluye todas sus versiones futuras. El dinero va al creador ({100 - premium.feePercent}%).</p>
                {premium.canBuy ? <BuyKitButton slug={meta.slug}>Comprar por {formatPrice(premium.priceCents)}</BuyKitButton> : <p>Inicia sesión para comprarlo.</p>}
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-10">
        {/* The shell shows the defaults; a recommendation in the URL (?animation=motion&why=…) streams in. */}
        <Suspense fallback={<Configurator kit={kit} kitRef={meta.slug} audits={audits} details={details} />}>
          <RecommendedConfigurator kit={kit} kitRef={meta.slug} audits={audits} details={details} searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

function StatCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      <dt className="label-mono text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const PLATFORMS: Record<string, string> = { linux: "Linux", darwin: "macOS", win32: "Windows" };

async function premiumState(meta: { priceCents?: number | null; slug: string; owner?: { handle: string } }, viewer: Awaited<ReturnType<typeof getViewer>>) {
  if (!meta.priceCents) return null;
  const row = await findCommunityVersion(meta.slug);
  const licensed = Boolean(row && viewer && (row.ownerId === viewer.id || (await hasLicense(row.kitId, viewer.id))));
  return { priceCents: meta.priceCents, licensed, canBuy: Boolean(viewer) && billingEnabled, feePercent: env.PLATFORM_FEE_PERCENT };
}

const formatPrice = (cents: number) => new Intl.NumberFormat("es", { style: "currency", currency: "EUR" }).format(cents / 100);

