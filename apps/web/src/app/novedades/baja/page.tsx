import type { Metadata } from "next";
import { Suspense } from "react";

import { unsubscribe } from "@/server/newsletter";

export const metadata: Metadata = { title: "Darse de baja", robots: { index: false } };

export default function UnsubscribePage({ searchParams }: PageProps<"/novedades/baja">) {
  return (
    <div className="mx-auto max-w-xl px-4 pt-16 sm:px-6">
      <Suspense fallback={<p className="text-muted-foreground">Un momento…</p>}>
        <Result params={searchParams.then((p) => ({ id: String(p.id ?? ""), sig: String(p.sig ?? "") }))} />
      </Suspense>
    </div>
  );
}

async function Result({ params }: { params: Promise<{ id: string; sig: string }> }) {
  const { id, sig } = await params;
  const ok = await unsubscribe(id, sig);
  return (
    <>
      <h1 className="text-2xl font-semibold">{ok ? "Te has dado de baja" : "El enlace no es válido"}</h1>
      <p className="mt-3 text-muted-foreground">{ok ? "No recibirás más emails." : "Usa el enlace del último email que recibiste."}</p>
    </>
  );
}
