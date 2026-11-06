import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/features/brands/back-link";
import { BrandCreator } from "@/features/brands/brand-creator";
import { listUserOrgs } from "@/server/orgs";
import { getViewer } from "@/server/session";

export const metadata: Metadata = { title: "New brand profile", robots: { index: false } };

export default function NewBrandPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <BackLink />
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">New brand profile</h1>
        <p className="max-w-2xl text-sm text-pretty text-muted-foreground">Colors, fonts, logo and favicon, applied to any kit with --brand. It takes under a minute.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Editor />
      </Suspense>
    </div>
  );
}

async function Editor() {
  const viewer = await getViewer();
  if (!viewer?.handle) redirect("/login?next=/brands/new");
  // Org profiles need admin; members see the org's profiles but don't create them.
  const orgs = (await listUserOrgs(viewer.id)).filter((o) => o.role !== "member").map((o) => o.org.slug);
  return <BrandCreator owners={[viewer.handle, ...orgs]} />;
}
