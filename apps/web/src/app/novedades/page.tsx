import type { Metadata } from "next";

import { SubscribeForm } from "@/features/newsletter/subscribe-form";
import { getChangelog } from "@/server/newsletter";

export const metadata: Metadata = {
  title: "Novedades",
  description: "Lo nuevo en kits: catálogo, kits oficiales, CLI y web. Y la newsletter semanal.",
  alternates: { types: { "application/rss+xml": "/novedades/rss.xml" } },
};

export default async function ChangelogPage() {
  const entries = await getChangelog();
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Novedades</h1>
      <section className="mt-8 flex flex-col gap-3">
        <h2 className="label-mono">Newsletter</h2>
        <SubscribeForm />
      </section>
      <ol className="mt-12 flex flex-col gap-10">
        {entries.map((e) => (
          <li key={`${e.date}-${e.title}`} className="grid gap-2 sm:grid-cols-[120px_1fr] sm:gap-6">
            <time dateTime={e.date} className="font-mono text-sm text-muted-foreground">{e.date}</time>
            <div>
              <h2 className="font-semibold">{e.title}</h2>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
                {e.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
