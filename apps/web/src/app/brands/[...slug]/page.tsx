import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { cliCommand } from "@kits/schema";
import { Command } from "@/components/shared/command";
import { BrandPreview } from "@/features/brands/brand-preview";
import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/features/brands/back-link";
import { BrandEditor } from "@/features/brands/brand-editor";
import { getBrand } from "@/server/brands";
import { getViewer } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/brands/[...slug]">): Promise<Metadata> {
  const slug = (await params).slug.join("/");
  const brand = await getBrand(slug, null);
  return brand ? { title: brand.profile.title, alternates: { canonical: `/brands/${slug}` } }
    : { title: "Brand profile", robots: { index: false } };
}

export default function BrandPage({ params }: PageProps<"/brands/[...slug]">) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <BackLink />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Editor slug={params.then((p) => p.slug.join("/"))} />
      </Suspense>
    </div>
  );
}

async function Editor({ slug: slugPromise }: { slug: Promise<string> }) {
  const viewer = await getViewer();
  const slug = await slugPromise;
  const found = await getBrand(slug, viewer);
  if (!found) notFound();
  return (
    <>
      <h1 className="font-mono text-3xl font-semibold tracking-tight">{slug}</h1>
      {found.canEdit ? <BrandEditor initialPrivate={found.row.isPrivate} owners={[slug.split("/")[0]!]} initialOwner={slug.split("/")[0]} initial={found.profile} /> : (
        <div className="grid items-start gap-6 sm:grid-cols-2">
          <BrandPreview profile={found.profile} />
          <section className="grid gap-3">
            <h2 className="label-mono">Use this brand</h2>
            <Command command={cliCommand(`landing-next --brand ${slug}`)} wrap />
            <Command command={cliCommand(`brand ${slug}`)} wrap />
          </section>
        </div>
      )}
    </>
  );
}
