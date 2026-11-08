import { brandProfileSchema, cliCommand } from "@kits/schema";
import Link from "next/link";

import { Command } from "@/components/shared/command";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { TabHeader } from "@/features/account/tab-header";
import { AgentSetup } from "@/features/agent-help/agent-setup";
import { listBrands } from "@/server/brands";
import type { TokenUser } from "@/server/tokens";

import { BrandPreview } from "./brand-editor";

/** The viewer's brand profiles with the "New" button, the empty state and Agent setup. Shared by /brands and the account tab. */
export async function MyBrands({ viewer }: { viewer: TokenUser }) {
  const brands = await listBrands(viewer);
  return (
    <>
      <TabHeader
        title="Brand profiles"
        description="A client's or your company's colors, fonts, logo, interface rules and documentation. Apply it to any kit and every new project starts with its identity."
        newHref={brands.length ? "/brands/new" : undefined}
        newLabel="New brand profile"
      />
      <BrandsBody brands={brands} />
    </>
  );
}

type Brands = Awaited<ReturnType<typeof listBrands>>;

/** The list (or the empty state) and Agent setup, for pages that draw their own header. */
export function BrandsBody({ brands }: { brands: Brands }) {
  return (
    <>
      {brands.length ? <BrandList brands={brands} /> : <NoBrands />}
      <AgentSetup tasks={["brand"]} className="w-fit" />
    </>
  );
}

function NoBrands() {
  return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>No brand profiles yet</EmptyTitle>
          <EmptyDescription>Create one per client: then just add --brand when creating each project.</EmptyDescription>
        </EmptyHeader>
        <Button nativeButton={false} render={<Link href="/brands/new" />}>Create the first one</Button>
      </Empty>
  );
}

function BrandList({ brands }: { brands: Brands }) {
  return (
    <section className="flex flex-col gap-4">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {brands.map((b) => {
          const profile = brandProfileSchema.safeParse(b.profile);
          return (
            <li key={b.id} className="flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/brands/${b.slug}`} className="truncate font-mono text-sm font-medium hover:underline">
                  {b.slug}
                </Link>
                <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/brands/${b.slug}`} />}>
                  Edit
                </Button>
              </div>
              {profile.success && <BrandPreview profile={profile.data} />}
              <Command command={cliCommand(`brand ${b.slug}`)} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

