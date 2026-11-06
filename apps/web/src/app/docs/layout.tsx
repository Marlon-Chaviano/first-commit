import { DocsNav } from "@/features/docs/docs-nav";
import { DocsPager } from "@/features/docs/docs-pager";
import { DocsToc } from "@/features/docs/docs-toc";

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-12 md:py-14 xl:max-w-7xl xl:grid-cols-[200px_minmax(0,1fr)_180px]">
      <aside className="md:sticky md:top-20 md:self-start">
        <DocsNav />
      </aside>
      <div className="min-w-0 max-w-3xl">
        <article data-docs-article>{children}</article>
        <DocsPager />
      </div>
      <aside className="hidden xl:sticky xl:top-20 xl:block xl:max-h-[calc(100svh-6rem)] xl:self-start xl:overflow-y-auto">
        <DocsToc />
      </aside>
    </div>
  );
}
