import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/features/brands/back-link";
import { BrandCreator } from "@/features/brands/brand-creator";
import { ResumeBrandDraft } from "@/features/brands/brand-editor";
import { ForkTemplate } from "@/features/brands/fork-template";
import { findBrandTemplate } from "@/features/brands/templates";
import { draftFromTemplate } from "@/server/brand-templates";
import { capabilitiesFor, listUserOrgs, type OrgRole } from "@/server/orgs";
import { getViewer } from "@/server/session";

export const metadata: Metadata = { title: "New brand profile", robots: { index: false } };

export default function NewBrandPage({ searchParams }: PageProps<"/brands/new">) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <BackLink />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Editor searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Editor({ searchParams }: Pick<PageProps<"/brands/new">, "searchParams">) {
  const { template: id, draft, name } = await searchParams;
  const viewer = await getViewer();
  if (id !== undefined) {
    const template = typeof id === "string" && findBrandTemplate(id);
    if (!template) notFound();
    const initialName = typeof name === "string" && /^[a-z0-9-]+$/.test(name) ? name : undefined;
    return (
      <>
        <h1 className="text-3xl font-semibold tracking-tight">Fork {template.title}</h1>
        <ForkTemplate owner={viewer?.handle ?? undefined} templateId={template.id} initialName={initialName} draft={await draftFromTemplate(template)} />
      </>
    );
  }
  if (draft !== undefined && (typeof draft !== "string" || !/^[a-f0-9-]{36}$/.test(draft))) notFound();
  const orgs = viewer?.handle ? (await listUserOrgs(viewer.id))
    .filter((o) => capabilitiesFor(o.role as OrgRole, viewer.id).canEditBrands).map((o) => o.org.slug) : [];
  const owners = viewer?.handle ? [viewer.handle, ...orgs] : [];
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">{draft ? "Review your brand" : "New brand profile"}</h1>
      {draft ? <ResumeBrandDraft key={draft} owners={owners} id={draft} /> : <BrandCreator owners={owners} />}
    </>
  );
}
