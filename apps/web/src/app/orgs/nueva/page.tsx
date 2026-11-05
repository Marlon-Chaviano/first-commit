import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { CreateOrgForm } from "@/features/orgs/org-forms";
import { getViewer } from "@/server/session";

export const metadata: Metadata = { title: "Nueva organización", robots: { index: false } };

export default function NewOrgPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <p className="label-mono text-muted-foreground">Organizaciones</p>
        <h1 className="text-3xl font-semibold tracking-tight">Nueva organización</h1>
        <p className="text-muted-foreground">
          Un registro privado para tu equipo: los kits con vuestro stack, vuestras reglas de AGENTS.md y vuestros MCP, solo para los miembros.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-60" />}>
        <Gate />
      </Suspense>
    </div>
  );
}

async function Gate() {
  if (!(await getViewer())) redirect("/entrar");
  return <CreateOrgForm />;
}
