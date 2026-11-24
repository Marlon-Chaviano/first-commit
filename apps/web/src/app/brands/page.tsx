import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentSetup } from "@/features/agent-help/agent-setup";
import { BrandActionsMenu } from "@/features/brands/brand-actions-menu";
import { BrandsBody } from "@/features/brands/brand-list";
import { BrandSkeletons } from "@/features/brands/brand-skeletons";
import { TemplateCatalog } from "@/features/brands/template-catalog";
import { brandCatalogPage } from "@/server/brand-catalog";
import { listBrands } from "@/server/brands";
import { getViewer } from "@/server/session";
import type { TokenUser } from "@/server/tokens";

export const metadata: Metadata = {
  alternates: { canonical: "/brands" },
  title: "Brand profiles and templates",
  description: "Browse official brand templates and community profiles, then apply their colors, typography and logos to any kit.",
};

export default function BrandsPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <header className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Brand profiles</h1>
        <p className="text-lg text-pretty text-muted-foreground">
          Start with a brand you like or bring your own. Share your design or keep it private and apply it to any kit with <code className="font-mono text-foreground">--brand</code>.
        </p>
      </header>
      <Suspense fallback={<ul aria-label="Loading brands" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><BrandSkeletons count={6} /></ul>}><BrandDirectory /></Suspense>
    </div>
  );
}

function BrandActions({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <div className="ml-auto flex items-center gap-3">
      <AgentSetup tasks={["brand"]} className="max-sm:[&>span[aria-hidden]]:hidden" />
      <Separator orientation="vertical" className="h-5 data-vertical:self-center" />
      {signedIn ? <BrandActionsMenu /> :
        <Button nativeButton={false} render={<Link href="/brands/new" aria-label="New brand profile" />}><PlusIcon /> New</Button>}
    </div>
  );
}

async function BrandDirectory() {
  await connection();
  const [viewer, initial] = await Promise.all([getViewer(), brandCatalogPage()]);
  const catalog = <TemplateCatalog initial={initial} />;
  if (!viewer) return <><BrandActions />{catalog}</>;
  return (
    <Tabs defaultValue="all" className="gap-5">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <TabsList variant="line" aria-label="Brand catalogs">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="mine">My brands</TabsTrigger>
        </TabsList>
        <BrandActions signedIn />
      </div>
      <TabsContent value="all" keepMounted>{catalog}</TabsContent>
      <TabsContent value="mine">
        <Suspense fallback={<ul aria-label="Loading my brands" aria-busy="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><BrandSkeletons count={3} /></ul>}>
          <MyProfiles viewer={viewer} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}

async function MyProfiles({ viewer }: { viewer: TokenUser }) {
  return <BrandsBody brands={await listBrands(viewer)} />;
}
