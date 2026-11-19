import { brandProfileSchema, cliCommand } from "@kits/schema";
import Link from "next/link";

import { Command } from "@/components/shared/command";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { TabHeader } from "@/features/account/tab-header";
import { AgentSetup } from "@/features/agent-help/agent-setup";
import { listBrands } from "@/server/brands";
import type { TokenUser } from "@/server/tokens";

import { BrandPreview } from "./brand-preview";

/** The viewer's brand profiles with the "New" button, the empty state and Agent setup. Shared by /brands and the account tab. */
export async function MyBrands({ viewer }: { viewer: TokenUser }) {
  const brands = await listBrands(viewer);
  return (
    <>
      <TabHeader
        title="Brand profiles"
        description="A client's or your company's colors, fonts, logo, interface rules and documentation. Apply it to any kit and every new project starts with its identity."
        newHref="/brands/new"
        action={<AgentSetup tasks={["brand"]} className="max-sm:[&>span[aria-hidden]]:hidden" />}
        newLabel="New brand profile"
      />
      <Link href="/brands#templates" className="w-fit text-sm underline underline-offset-4">Browse brand templates</Link>
      <BrandsBody brands={brands} />
    </>
  );
}

type Brands = Awaited<ReturnType<typeof listBrands>>;

export function BrandsBody({ brands }: { brands: Brands }) {
  return brands.length ? <BrandList brands={brands} /> : <NoBrands />;
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
          const href = `/brands/${b.slug}` as const;
          const edit = <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href} aria-label={`Edit ${b.slug}`} />}>Edit</Button>;
          return (
            <li key={b.id} className="min-w-0">
              {profile.success ? (
                <BrandPreview
                  profile={profile.data}
                  action={edit}
                  footer={<Command command={cliCommand(`brand ${b.slug}`)} wrap />}
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3">
                  <p className="text-sm">{b.slug}</p>
                  {edit}
                  <p className="w-full text-xs text-destructive">This profile’s preview is unavailable.</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
