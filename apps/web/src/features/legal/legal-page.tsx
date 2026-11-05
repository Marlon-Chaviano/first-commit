import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Layout for the legal pages. The banner stays until a lawyer has reviewed the text (phase 8). */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 font-mono text-xs text-muted-foreground">Actualizado: {updated}</p>
      <Alert className="mt-6">
        <AlertTitle>Borrador</AlertTitle>
        <AlertDescription>Texto pendiente de revisión legal antes del lanzamiento.</AlertDescription>
      </Alert>
      <div className="mt-8 flex flex-col gap-4 text-muted-foreground [&_h2]:mt-6 [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </div>
  );
}
