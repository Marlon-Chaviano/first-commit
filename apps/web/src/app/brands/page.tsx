import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cache, Suspense } from "react";

import { Button } from "@/components/ui/button";
import { AgentSetup } from "@/features/agent-help/agent-setup";
import { BrandsBody } from "@/features/brands/brand-list";
import { TemplateCatalog } from "@/features/brands/template-catalog";
import { brandTemplatePage } from "@/features/brands/templates";
import { listBrands } from "@/server/brands";
import { getViewer } from "@/server/session";

const viewerForPage = cache(getViewer);

export const metadata: Metadata = {
  alternates: { canonical: "/brands" },
  title: "Brand profiles and templates",
  description: "Browse brand-inspired design templates, customize a private profile and apply its colors, typography and logo to any kit.",
};

export default function BrandsPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex max-w-2xl flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Brand profiles</h1>
          <p className="text-lg text-pretty text-muted-foreground">
            Start with a brand you like or bring your own. Save your design as a private profile and apply it to any kit with <code className="font-mono text-foreground">--brand</code>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Suspense fallback={null}><ProfileShortcut /></Suspense>
          <div className="flex flex-wrap items-center gap-2">
            <AgentSetup tasks={["brand"]} className="max-sm:[&>span[aria-hidden]]:hidden" />
            <Button nativeButton={false} render={<Link href="/brands/new" aria-label="New brand profile" />}><PlusIcon /> New</Button>
          </div>
        </div>
      </header>
      <TemplateCatalog initial={brandTemplatePage()} />
      <Suspense fallback={null}><Profiles /></Suspense>
    </div>
  );
}

async function ProfileShortcut() {
  return (await viewerForPage()) && <Link href="#your-profiles" className="w-fit text-sm underline underline-offset-4">Your profiles</Link>;
}

async function Profiles() {
  const viewer = await viewerForPage();
  if (!viewer) return null;
  return (
    <section id="your-profiles" className="flex scroll-mt-20 flex-col gap-4">
      <h2 className="label-mono">Your profiles</h2>
      <BrandsBody brands={await listBrands(viewer)} />
    </section>
  );
}
