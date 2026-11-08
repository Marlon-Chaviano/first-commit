import { LIBRARY_CATEGORIES } from "@kits/schema";
import type { Metadata } from "next";

import { TechLogo } from "@/components/shared/tech-logo";
import { Badge } from "@/components/ui/badge";
import { Code, DocsHeader, H2 } from "@/features/docs/docs-ui";
import { getCatalog } from "@/server/registry";

export const metadata: Metadata = {
  alternates: { canonical: "/docs/libraries" },
  title: "Library catalog",
  description: "UI, animation, auth, database, payments, email, AI, observability, testing and deployment libraries any kit can offer.",
};

export default async function LibrariesDocs() {
  const catalog = await getCatalog();
  return (
    <>
      <DocsHeader title="Library catalog">
        Any kit can offer them by declaring <Code>libraries</Code>. Picking one installs its packages and its official skill, writes
        its config and adds the rule to use it to <Code>AGENTS.md</Code>. {catalog.length} libraries.
      </DocsHeader>

      {LIBRARY_CATEGORIES.map(({ kind, label: title, key }) => (
        <section key={kind}>
          <H2 id={kind}>
            {title} <span className="text-muted-foreground">· libraries.{key}</span>
          </H2>
          <ul className="divide-y">
            {catalog
              .filter((l) => l.kind === kind)
              .map((lib) => (
                <li key={lib.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <a href={lib.url} className="flex items-center gap-2 font-medium hover:underline">
                      <TechLogo id={lib.id} label="" className="size-4" />
                      {lib.name}
                    </a>
                    <span className="text-sm text-muted-foreground">{lib.description}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:max-w-1/2 sm:justify-end">
                    <code className="font-mono text-xs text-muted-foreground">{lib.id}</code>
                    {lib.frameworks.map((f) => (
                      <Badge key={f} variant="outline" className="font-mono">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}
