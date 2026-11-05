import { brandProfileSchema, cliCommand } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Command } from "@/components/shared/command";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandPreview } from "@/features/brands/brand-editor";
import { listBrands } from "@/server/brands";
import { getViewer } from "@/server/session";

export const metadata: Metadata = { title: "Perfiles de marca", robots: { index: false } };

export default function BrandsPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-12">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="label-mono text-muted-foreground">Tu cuenta</p>
          <h1 className="text-3xl font-semibold text-balance">Perfiles de marca</h1>
          <p className="max-w-xl text-pretty text-muted-foreground">
            Los colores, las fuentes, las reglas de interfaz y la documentación de un cliente o de tu empresa. Aplícalo a cualquier kit y
            cada proyecto nuevo empieza con su identidad, sin configurarla otra vez.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/cuenta/marcas/nueva" />}>Nuevo perfil</Button>
      </header>
      <Suspense fallback={<Skeleton className="h-60" />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar");
  const brands = await listBrands(viewer);
  if (!brands.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Aún no tienes perfiles de marca</EmptyTitle>
          <EmptyDescription>Crea uno por cliente: luego basta con añadir --brand al crear cada proyecto.</EmptyDescription>
        </EmptyHeader>
        <Button nativeButton={false} render={<Link href="/cuenta/marcas/nueva" />}>Crear el primero</Button>
      </Empty>
    );
  }
  return (
    <section className="flex flex-col gap-4">
      <Separator />
      <ul className="grid gap-4 sm:grid-cols-2">
        {brands.map((b) => {
          const profile = brandProfileSchema.safeParse(b.profile);
          return (
            <li key={b.id} className="flex flex-col gap-3">
              <Link href={`/cuenta/marcas/${b.slug}`} className="font-mono text-sm hover:underline">{b.slug}</Link>
              {profile.success && <BrandPreview profile={profile.data} />}
              <Command command={cliCommand(`brand ${b.slug}`)} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
