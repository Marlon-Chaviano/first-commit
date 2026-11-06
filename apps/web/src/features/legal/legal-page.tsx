/** Layout for the legal pages: title, effective date and readable prose. */
export function LegalPage({ title, updated, summary, children }: { title: string; updated: string; summary: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-8 sm:px-6 sm:pt-12">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        Last updated: <time dateTime={updated}>{updated}</time>
      </p>
      <div className="mt-6 rounded-lg border p-4 text-sm text-pretty text-muted-foreground">{summary}</div>
      <div className="mt-8 flex flex-col gap-4 text-pretty text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:wrap-anywhere [&_code]:text-foreground [&_h2]:mt-6 [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2">
        {children}
      </div>
    </div>
  );
}
