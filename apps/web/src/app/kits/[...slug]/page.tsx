import { allKitSkills, AUTHOR, BRAND, CATEGORY_LABELS, kitLanguage, LANGUAGES, defaultSelections, selectionsFrom, type Selections, cliCommand, REPO_URL, pruneSelections, resolve } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";
import { LockIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense, type ComponentProps } from "react";

import { CopyButton } from "@/components/shared/copy-button";
import { TechIcon, TechLogo } from "@/components/shared/tech-icon";
import { Sparkline } from "@/components/shared/sparkline";
import { Badge } from "@/components/ui/badge";
import { ScrollToTop } from "@/components/shared/scroll-to-top";
import { UserAvatar } from "@/components/shared/user-avatar";
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
import { getSharedConfig, SHARE_PARAM } from "@/server/share";
import { OriginIcon } from "@/components/shared/origin-icon";
import { formatCount } from "@/lib/format";
import { getKitStats } from "@/server/metrics/queries";
import { canReadKit, kitAccess } from "@/server/kit-access";
import { findCommunityVersion, getIndex, getKitPage } from "@/server/registry";
import { env } from "@/server/env";
import { billingEnabled } from "@/server/stripe";
import { getViewer } from "@/server/session";
import { getInstallMinutes, getVerification } from "@/server/verifications/queries";
import { WhatYouGet } from "@/features/kits/what-you-get";
import { getSkillAudits } from "@/server/audits";
import { pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/shared/json-ld";
import { ogImageUrl } from "@/server/og";

// Official kits are prerendered; community kits ("ana/landing") render on first visit.
export async function generateStaticParams() {
  return (await getIndex()).map((k) => ({ slug: [k.name] }));
}

export async function generateMetadata({ params }: PageProps<"/kits/[...slug]">): Promise<Metadata> {
  const page = await getKitPage((await params).slug.join("/"));
  // Private kits: no title or description in metadata (it's rendered before the membership check).
  if (!page || page.meta.visibility !== "public") return { robots: { index: false } };
  const slug = page.meta.slug;
  return pageMetadata({
    title: `${page.kit.title} (${slug})`,
    description: page.kit.description,
    path: `/kits/${slug}`,
    image: { url: ogImageUrl("kits", slug), alt: `${page.kit.title}: ${cliCommand(slug)}` },
  });
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
}: { searchParams: PageProps<"/kits/[...slug]">["searchParams"] } & Omit<ComponentProps<typeof Configurator>, "initial" | "reasons" | "initialName">) {
  const { [SHARE_PARAM]: shareId, ...params } = await searchParams;
  // A shared link (/k/<id> → ?c=<id>): exactly what the person shared, checked against today's kit.
  const shared = typeof shareId === "string" ? await getSharedConfig(shareId) : null;
  if (shared && shared.kit === props.kitRef) {
    try {
      return <Configurator {...props} initial={pruneSelections(props.kit, shared.selections)} initialName={shared.name ?? undefined} />;
    } catch {
      // The kit changed since and the configuration no longer fits: fall through to the defaults.
    }
  }
  const { options, reasons } = readRecommendation(params);
  if (!Object.keys(options).length) return <Configurator {...props} />;
  let initial: Selections;
  try {
    initial = selectionsFrom(props.kit, { options }, { requirements: "prune", unknown: "ignore" }).selections;
  } catch {
    initial = defaultSelections(props.kit); // A hand-edited URL that isn't a valid combination: show the defaults.
  }
  return <Configurator {...props} initial={initial} reasons={reasons} />;
}

function KitSkeleton() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pt-8 sm:px-6 sm:pt-12">
      <ScrollToTop />
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
  const [stats, verification, audits, installMinutes] = await Promise.all([
    getKitStats(meta.slug),
    getVerification(meta.slug, meta.version),
    getSkillAudits(allKitSkills(kit)),
    getInstallMinutes(meta.slug, meta.version),
  ]);
  const defaults = defaultSelections(kit);

  const languageLabel = LANGUAGES.find((l) => l.id === kitLanguage(kit))?.label ?? "";
  // Details for the sticky column next to the install command.
  const details = (
    <section className="flex flex-col gap-4 rounded-xl border p-4 text-sm">
      <h2 className="font-semibold">Details</h2>
      <dl className="flex flex-col gap-3">
        <Row label="Author">
          {meta.owner ? (
            <Link href={`/u/${meta.owner.handle}`} className="flex items-center gap-2 font-mono hover:underline">
              <UserAvatar name={meta.owner.name || meta.owner.handle} image={meta.owner.image} size="sm" />
              {meta.owner.handle}
            </Link>
          ) : kit.author === AUTHOR.name ? (
            // Official kits: their author's GitHub picture.
            <a href={AUTHOR.github} className="flex items-center gap-2 font-mono hover:underline">
              <UserAvatar name={kit.author} image={`${AUTHOR.github}.png?size=64`} size="sm" />
              {kit.author}
            </a>
          ) : (
            <span className="flex items-center gap-2 font-mono">
              <UserAvatar name={kit.author} size="sm" />
              {kit.author}
            </span>
          )}
        </Row>
        {meta.repo && !meta.official && (
          <Row label="Source">
            <a href={`https://github.com/${meta.repo}`} className="font-mono break-all hover:underline">
              {meta.repo}
              {meta.path ? `/${meta.path}` : ""}
            </a>
          </Row>
        )}
        <Row label="Verification">
          {verification.verified ? (
            <span className="flex items-center gap-1.5"><OriginIcon origin="verified" className="size-4" /> Verified</span>
          ) : (
            <span className="text-muted-foreground">{verification.platforms.length ? "The last test failed" : `Unverified · ${BRAND.cli} test in CI`}</span>
          )}
        </Row>
        {verification.platforms.length > 0 && (
          <Row label="Platforms">
            <span className="font-mono text-xs text-muted-foreground">
              {verification.platforms.map((p) => `${p.ok ? "✓" : "✗"} ${PLATFORMS[p.platform] ?? p.platform}`).join(" · ")}
            </span>
          </Row>
        )}
        <Row label="Badge">
          <span className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- an SVG badge, same as in a README */}
            <img src={`/badge/${meta.slug}.svg`} alt={`${BRAND.name}: installs of ${meta.slug}`} height={20} className="h-5 w-fit" />
            <CopyButton text={`[![${BRAND.name}](${BRAND.siteUrl}/badge/${meta.slug}.svg)](${BRAND.siteUrl}/kits/${meta.slug})`} label="Copy badge Markdown" />
          </span>
        </Row>
      </dl>
      <ReportDialog kit={meta.slug} />
    </section>
  );

  const url = `${BRAND.siteUrl}/kits/${meta.slug}`;
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      {meta.visibility === "public" && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "SoftwareSourceCode",
                name: kit.title,
                alternateName: meta.slug,
                description: kit.description,
                url,
                image: `${BRAND.siteUrl}${ogImageUrl("kits", meta.slug)}`,
                codeRepository: meta.official ? `${REPO_URL}/tree/${BRAND.branch}/registry/kits/${meta.slug}` : meta.repo ? `https://github.com/${meta.repo}` : undefined,
                programmingLanguage: languageLabel || undefined,
                keywords: kit.tags.join(", "),
                version: meta.version,
                author: { "@type": "Person", name: meta.owner?.name || meta.owner?.handle || kit.author },
                isAccessibleForFree: true,
                // What an answer engine should quote: the exact command.
                text: cliCommand(meta.slug),
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Kits", item: `${BRAND.siteUrl}/#leaderboard` },
                  { "@type": "ListItem", position: 2, name: meta.slug, item: url },
                ],
              },
            ],
          }}
        />
      )}
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
        <TechIcon id={kitLanguage(kit)} label={languageLabel} className="size-10 shrink-0" />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{kit.title}</h1>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="gap-1">
                <OriginIcon origin={meta.official ? "official" : "community"} className="size-3" />
                {meta.official ? "Official" : "Community"}
              </Badge>
              {verification.verified && (
                <Badge variant="outline" className="gap-1">
                  <OriginIcon origin="verified" className="size-3" /> Verified
                </Badge>
              )}
              <Badge variant="outline" className="font-mono">v{kit.version}</Badge>
            </div>
          </div>
          <p className="font-mono text-sm text-muted-foreground">{meta.slug}</p>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{kit.description}</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {kit.tags.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1.5 font-mono font-normal">
                <TechLogo id={t} label="" className="size-3" />
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </header>

      <dl className="mt-8 grid grid-cols-2 overflow-hidden rounded-xl border sm:grid-cols-4 [&>div]:border-border [&>div:nth-child(2n)]:border-l sm:[&>div]:border-l sm:[&>div:first-child]:border-l-0 [&>div:nth-child(n+3)]:border-t sm:[&>div:nth-child(n+3)]:border-t-0">
        <StatCell label="Installs">
          <span className="flex items-end justify-between gap-3">
            <span className="font-mono text-2xl font-semibold tabular-nums">{formatCount(stats.installs)}</span>
            <Sparkline values={stats.weekly} className="h-7 w-20" />
          </span>
        </StatCell>
        <StatCell label="People">
          <span className="font-mono text-2xl font-semibold tabular-nums">{formatCount(stats.unique)}</span>
        </StatCell>
        <StatCell label="Skills">
          <span className="font-mono text-2xl font-semibold tabular-nums">{allKitSkills(kit).length}</span>
        </StatCell>
        <StatCell label={CATEGORY_LABELS[kit.category]}>
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
            Paid kit · {formatPrice(premium.priceCents)}
            {premium.licensed && " · it's yours"}
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            {premium.licensed ? (
              <p>Install it with the command below after logging in to the CLI ({`${BRAND.cli} login`}).</p>
            ) : (
              <>
                <p>One-time payment: includes all its future versions. The money goes to the creator ({100 - premium.feePercent}%).</p>
                {premium.canBuy ? <BuyKitButton slug={meta.slug}>Buy for {formatPrice(premium.priceCents)}</BuyKitButton> : <p>Log in to buy it.</p>}
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-10">
        <WhatYouGet kit={kit} resolved={resolve(kit, defaults)} options={defaults.options} installMinutes={installMinutes} />
      </div>

      <div className="mt-10">
        {/* The shell shows the defaults; a recommendation in the URL (?animation=motion&why=…) streams in. */}
        <Suspense fallback={<Configurator kit={kit} kitRef={meta.slug} audits={audits} details={details} />}>
          <RecommendedConfigurator kit={kit} kitRef={meta.slug} audits={audits} details={details} searchParams={searchParams} shareable={meta.visibility === "public"} />
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
  // Owner, site admin or a license: the same answer the download route gives.
  const licensed = Boolean(row && (await kitAccess(row, viewer)).install);
  return { priceCents: meta.priceCents, licensed, canBuy: Boolean(viewer) && billingEnabled, feePercent: env.PLATFORM_FEE_PERCENT };
}

const formatPrice = (cents: number) => new Intl.NumberFormat("en", { style: "currency", currency: "EUR" }).format(cents / 100);

