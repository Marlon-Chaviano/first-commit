import { LIBRARY_CATEGORIES } from "@kits/schema";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Code, DocsHeader, H2 } from "@/features/docs/docs-ui";
import { getCatalog } from "@/server/registry";

export const metadata: Metadata = {
  title: "Catálogo de bibliotecas",
  description: "Bibliotecas de UI, animación, auth, base de datos, pagos, email, IA, observabilidad, tests y despliegue que cualquier kit puede ofrecer.",
};

export default async function LibrariesDocs() {
  const catalog = await getCatalog();
  return (
    <>
      <DocsHeader title="Catálogo de bibliotecas">
        Cualquier kit puede ofrecerlas declarando <Code>libraries</Code>. Elegir una instala sus paquetes y su skill oficial,
        escribe su configuración y añade a <Code>AGENTS.md</Code> la regla de usarla. {catalog.length} bibliotecas.
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
                    <a href={lib.url} className="font-medium hover:underline">
                      {lib.name}
                    </a>
                    <span className="text-sm text-muted-foreground">{lib.description}</span>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
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
