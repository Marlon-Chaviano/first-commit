import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { KitCreator } from "@/features/repository-import/kit-creator";
import { importAccess } from "@/server/repository-import/access";
import { getViewer } from "@/server/session";

export const metadata: Metadata = { title: "Create a kit from GitHub", robots: { index: false } };

export default function NewKitPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-7 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Create a kit from GitHub</h1>
        <p className="text-pretty text-muted-foreground">
          Turn a project into a reusable starter. Choose its repository, review the dependencies and files, then download your kit.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-48" />}>
        <Creator />
      </Suspense>
      <Link href="/publish" className="w-fit text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
        Already have a kit.json? Publish a kit
      </Link>
    </div>
  );
}

async function Creator() {
  return <KitCreator access={await importAccess(await getViewer())} />;
}
