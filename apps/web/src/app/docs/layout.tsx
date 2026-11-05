import { DocsNav } from "@/features/docs/docs-nav";

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-12 md:py-14">
      <aside className="md:sticky md:top-20 md:self-start">
        <DocsNav />
      </aside>
      <article className="max-w-3xl">{children}</article>
    </div>
  );
}
