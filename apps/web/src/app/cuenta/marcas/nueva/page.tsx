import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { BrandEditor } from "@/features/brands/brand-editor";
import { listUserOrgs } from "@/server/orgs";
import { getViewer } from "@/server/session";

export const metadata: Metadata = { title: "Nuevo perfil de marca", robots: { index: false } };

export default function NewBrandPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12">
      <h1 className="text-3xl font-semibold">Nuevo perfil de marca</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Editor />
      </Suspense>
    </div>
  );
}

async function Editor() {
  const viewer = await getViewer();
  if (!viewer?.handle) redirect("/entrar");
  // Org profiles need admin; members see the org's profiles but don't create them.
  const orgs = (await listUserOrgs(viewer.id)).filter((o) => o.role !== "member").map((o) => o.org.slug);
  return <BrandEditor owners={[viewer.handle, ...orgs]} />;
}
