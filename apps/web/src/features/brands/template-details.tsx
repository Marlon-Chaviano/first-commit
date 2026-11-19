import { GitForkIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { BackLink } from "./back-link";
import type { BrandTemplate } from "./templates";

const roles = {
  primary: "Primary", primaryForeground: "Text on primary", accent: "Accent",
  background: "Background", foreground: "Text",
} as const;

export function TemplateDetails({ template }: { template: BrandTemplate }) {
  const { id, title, fonts, colors, radius, rule, domain } = template;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <BackLink />
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title} brand template</h1>
          <a className="mt-2 inline-block text-sm text-muted-foreground underline underline-offset-4" href={`https://${domain}`}>{domain}</a>
        </div>
        <Button nativeButton={false} render={<Link href={`/brands/new?template=${id}`} />}>
          <GitForkIcon /> Fork to my brands
        </Button>
      </header>
      <section aria-label="Design specimen" className="grid overflow-hidden rounded-xl border sm:grid-cols-[1fr_2fr]">
        <div className="grid min-h-44 place-items-center bg-card p-8">
          {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-sized catalog artwork */}
          <img alt={title + " logo"} src={`/brand-templates/${id}.svg`} width={112} height={112} className="size-28 object-contain" />
        </div>
        <div className="flex min-h-44 flex-col justify-center gap-2 p-8" style={{ backgroundColor: colors.primary, color: colors.primaryForeground }}>
          <span className="text-4xl font-semibold tracking-tight sm:text-6xl" style={{ fontFamily: `"${fonts.heading ?? fonts.sans}", sans-serif` }}>{title}</span>
          <span className="font-mono text-sm">{fonts.heading ?? fonts.sans}</span>
        </div>
      </section>
      <section aria-labelledby="palette">
        <h2 id="palette" className="label-mono mb-3">Color palette</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {(Object.keys(roles) as (keyof typeof roles)[]).map((key) => (
            <div key={key}>
              <div className="mb-2 h-12 rounded-md border" style={{ backgroundColor: colors[key] }} />
              <dt className="text-sm">{roles[key]}</dt>
              <dd className="font-mono text-xs text-muted-foreground">{colors[key]}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="grid gap-6 border-t pt-6 sm:grid-cols-2">
        <div>
          <h2 className="label-mono mb-2">Typography and shape</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-sm">
            <dt>Body</dt><dd>{fonts.sans}</dd>
            <dt>Headings</dt><dd>{fonts.heading ?? fonts.sans}</dd>
            <dt>Corner radius</dt><dd className="font-mono">{radius}</dd>
          </dl>
        </div>
        <div><h2 className="label-mono mb-2">Interface rule</h2><p className="max-w-prose text-sm">{rule}</p></div>
      </div>
    </div>
  );
}
