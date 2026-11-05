import { BRAND } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { Sparkline } from "@/components/shared/sparkline";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount } from "@/lib/format";
import { getKitHistory } from "@/server/accounts";
import { getKitStats } from "@/server/metrics/queries";
import { PriceForm } from "@/features/billing/buttons";
import { userPlan } from "@/server/billing";
import { getOrgById, roleIn } from "@/server/orgs";
import { effectivePlan, PLANS } from "@/server/plans";
import { billingEnabled } from "@/server/stripe";
import { findCommunityVersion } from "@/server/registry";
import { getViewer, isAdmin } from "@/server/session";

export const metadata: Metadata = { title: "Estadísticas del kit" };

export default function KitStatsPage({ params }: PageProps<"/cuenta/kits/[...slug]">) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-12">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Stats slug={params.then((p) => p.slug.join("/"))} />
      </Suspense>
    </div>
  );
}

async function Stats({ slug: slugPromise }: { slug: Promise<string> }) {
  const slug = await slugPromise;
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar");
  const kit = await findCommunityVersion(slug);
  if (!kit) notFound();
  // Detailed numbers are for the owner (and moderators); the public page shows totals.
  const orgAdmin = kit.orgId ? ["owner", "admin"].includes((await roleIn(kit.orgId, viewer.id)) ?? "") : false;
  if (kit.ownerId !== viewer.id && !isAdmin(viewer) && !orgAdmin) notFound();

  // Plan of whoever pays for these numbers: the org for org kits, the owner otherwise.
  const plan = effectivePlan(kit.orgId ? (await getOrgById(kit.orgId))?.plan : await userPlan(kit.ownerId ?? viewer.id), billingEnabled);
  const days = PLANS[plan].historyDays;
  const [live, history] = await Promise.all([getKitStats(slug), getKitHistory(slug, days)]);
  const breakdown = Object.entries(live.breakdown).sort((a, b) => b[1] - a[1]);
  const group = (prefix: string) => breakdown.filter(([k]) => (prefix ? k.startsWith(prefix) : !k.startsWith("agent=") && !k.startsWith("pm=")));

  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="label-mono text-muted-foreground">Estadísticas</p>
        <h1 className="font-mono text-3xl font-semibold">
          <Link href={`/kits/${slug}`} className="hover:underline">
            {slug}
          </Link>
        </h1>
      </header>

      {billingEnabled && kit.ownerId === viewer.id && kit.visibility === "public" && (
        <section className="flex flex-col gap-2">
          <h2 className="label-mono">Precio</h2>
          <PriceForm slug={slug} priceCents={kit.priceCents} />
        </section>
      )}

      <section className="grid gap-6 sm:grid-cols-3">
        <Number label="Instalaciones" value={live.installs} />
        <Number label="Usuarios únicos" value={live.unique} />
        <div className="flex flex-col gap-2">
          <h2 className="label-mono">Últimas 8 semanas</h2>
          <Sparkline values={live.weekly} className="h-10" />
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        <Number label="Actualizaciones" value={live.retention.update ?? 0} />
        <Number label="Bibliotecas añadidas" value={live.retention.add ?? 0} />
      </section>
      <Breakdown
        title={`Añadido después con ${BRAND.cli} add`}
        rows={Object.entries(live.retention)
          .filter(([k]) => k.startsWith("add:"))
          .map(([k, v]) => [k.slice(4), v] as [string, number])}
      />
      <Breakdown title="Opciones elegidas" rows={group("")} />
      <Breakdown title="Agentes" rows={group("agent=").map(([k, v]) => [k.slice(6), v])} />
      <Breakdown title="Gestor de paquetes" rows={group("pm=").map(([k, v]) => [k.slice(3), v])} />
      <Breakdown title="Versiones" rows={history.versions.map((v) => [v.version ?? "desconocida", v.installs])} />
      <Breakdown title="Países" rows={history.countries.map((c) => [c.country ?? "desconocido", c.installs])} />
      <Breakdown title={`Últimos ${days} días`} rows={history.daily.map((d) => [d.day, d.installs])} />
      <p className="text-sm text-muted-foreground">
        {PLANS[plan].csvExport ? (
          <a className="underline underline-offset-4" href={`/api/v1/stats/${slug}`}>Descargar CSV</a>
        ) : (
          <>Historial de 12 meses y CSV con el plan Pro (en <Link className="underline underline-offset-4" href="/cuenta">tu cuenta</Link>).</>
        )}
      </p>
    </>
  );
}

function Number({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="label-mono">{label}</h2>
      <p className="font-mono text-3xl font-semibold">{formatCount(value)}</p>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <section className="flex flex-col gap-3">
      <h2 className="label-mono">{title}</h2>
      <Separator />
      {rows.length ? (
        <ul className="flex flex-col gap-2">
          {rows.map(([label, value]) => (
            <li key={label} className="grid grid-cols-[minmax(0,12rem)_1fr_3rem] items-center gap-3 text-sm">
              <span className="truncate font-mono text-xs">{label}</span>
              <span className="h-1.5 rounded-full bg-foreground/80" style={{ width: `${(value / max) * 100}%` }} />
              <span className="text-right font-mono text-xs text-muted-foreground">{value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
      )}
    </section>
  );
}
