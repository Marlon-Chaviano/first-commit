import { brandProfileSchema } from "@kits/schema";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { TabHeader } from "@/features/account/tab-header";
import { AgentSetup } from "@/features/agent-help/agent-setup";
import { listBrands } from "@/server/brands";
import type { TokenUser } from "@/server/tokens";

import { BrandCard } from "./brand-card";

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
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((b) => {
          const profile = brandProfileSchema.safeParse(b.profile);
          const href = `/brands/${b.slug}` as const;
          return (
            <li key={b.id} className="min-w-0">
              {profile.success ? (
                <BrandCard href={href} attribution={b.isPrivate ? "Private" : "Public"} label={`View ${b.slug}`} profile={{
                  title: profile.data.title, colors: profile.data.colors, dark: profile.data.dark,
                  fonts: profile.data.fonts, radius: profile.data.radius,
                  assets: {
                    logo: profile.data.assets.logo ?? profile.data.logo ?? profile.data.assets.icon ?? profile.data.assets.appleTouchIcon,
                    logoDark: profile.data.assets.logoDark,
                  },
                }} />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3">
                  <p className="text-sm">{b.slug}</p>
                  <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href} aria-label={`View ${b.slug}`} />}>View</Button>
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
