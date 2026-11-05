import { BRAND, FRAMEWORK_LABELS } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { JsonLd } from "@/components/shared/json-ld";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount } from "@/lib/format";
import { getComparison, getComparisonSlugs, type LibraryUsage } from "@/server/compare";

export async function generateStaticParams() {
  return (await getComparisonSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/comparar/[slug]">): Promise<Metadata> {
  const c = await getComparison((await params).slug);
  if (!c) return {};
  const title = `${c.a.library.name} vs ${c.b.library.name}`;
  return { title, description: `${title}: qué ofrece cada una, en qué frameworks funciona y cuánto se elige en los kits.`, alternates: { canonical: `/comparar/${c.slug}` } };
}

// Popular stacks and new comparisons appear after the build, so params are request data for them.
export default function ComparePage({ params }: PageProps<"/comparar/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6"><Skeleton className="h-96" /></div>}>
      <CompareContent slug={params.then((p) => p.slug)} />
    </Suspense>
  );
}

async function CompareContent({ slug }: { slug: Promise<string> }) {
  const c = await getComparison(await slug);
  if (!c) notFound();
  const title = `${c.a.library.name} vs ${c.b.library.name}`;
  const rows: [string, (u: LibraryUsage) => React.ReactNode][] = [
    ["Qué es", (u) => u.library.description],
    ["Frameworks", (u) => u.library.frameworks.map((f) => FRAMEWORK_LABELS[f] ?? f).join(", ")],
    ["Paquetes", (u) => (u.library.dependencies.length ? <code className="font-mono text-xs">{[...u.library.dependencies, ...u.library.devDependencies].join(" ")}</code> : "—")],
    ["Skill oficial", (u) => (u.library.skills.length ? <code className="font-mono text-xs">{u.library.skills.join(", ")}</code> : "—")],
    ["Cómo la usa tu agente", (u) => u.library.usage],
    ["Kits que la ofrecen", (u) => (u.kits.length ? u.kits.map((k, i) => <span key={k}>{i > 0 && ", "}<Link className="underline underline-offset-4" href={`/kits/${k}`}>{k}</Link></span>) : "—")],
    ["Elegida en", (u) => `${formatCount(u.installs)} instalaciones`],
  ];
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: title,
          url: `${BRAND.siteUrl}/comparar/${c.slug}`,
          about: [c.a, c.b].map((u) => ({ "@type": "SoftwareApplication", name: u.library.name, url: u.library.url, applicationCategory: c.category })),
        }}
      />
      <p className="label-mono text-muted-foreground">comparar · {c.category}</p>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        Las dos funcionan con {c.sharedFrameworks.map((f) => FRAMEWORK_LABELS[f] ?? f).join(", ")}. En un kit eliges una y tu agente
        recibe la regla de usar solo esa.
      </p>
      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[560px] border-y text-sm">
          <thead>
            <tr className="border-b">
              <th className="w-44 py-3 text-left font-normal" />
              {[c.a, c.b].map((u) => (
                <th key={u.library.id} className="py-3 text-left font-semibold">
                  <a href={u.library.url} className="hover:underline">{u.library.name}</a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(([label, cell]) => (
              <tr key={label} className="align-top">
                <th className="py-3 pr-4 text-left font-normal text-muted-foreground">{label}</th>
                <td className="py-3 pr-4">{cell(c.a)}</td>
                <td className="py-3">{cell(c.b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
