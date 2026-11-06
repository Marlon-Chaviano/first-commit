import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { MyBrands } from "@/features/brands/brand-list";
import { getViewer } from "@/server/session";

export const metadata: Metadata = { title: "Brand profiles", robots: { index: false } };

/** The profile's Brands tab: the same list as /brands, where creating and editing happen. */
export default function AccountBrandsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-60" />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account/brands");
  return <MyBrands viewer={viewer} />;
}
