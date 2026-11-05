import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { BrandEditor } from "@/features/brands/brand-editor";
import { getBrand } from "@/server/brands";
import { getViewer } from "@/server/session";

export const metadata: Metadata = { title: "Perfil de marca", robots: { index: false } };

export default function BrandPage({ params }: PageProps<"/cuenta/marcas/[...slug]">) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Editor slug={params.then((p) => p.slug.join("/"))} />
      </Suspense>
    </div>
  );
}

async function Editor({ slug: slugPromise }: { slug: Promise<string> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar");
  const slug = await slugPromise;
  const found = await getBrand(slug, viewer);
  if (!found) notFound();
  return (
    <>
      <h1 className="font-mono text-3xl font-semibold">{slug}</h1>
      <BrandEditor owners={[slug.split("/")[0]!]} initialOwner={slug.split("/")[0]} initial={found.profile} />
    </>
  );
}
