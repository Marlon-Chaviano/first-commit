import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { confirmSubscription } from "@/server/newsletter";

export const metadata: Metadata = { title: "Confirmar suscripción", robots: { index: false } };

export default function ConfirmPage({ searchParams }: PageProps<"/novedades/confirmar">) {
  return (
    <div className="mx-auto max-w-xl px-4 pt-16 sm:px-6">
      <Suspense fallback={<p className="text-muted-foreground">Confirmando…</p>}>
        <Result token={searchParams.then((p) => String(p.token ?? ""))} />
      </Suspense>
    </div>
  );
}

async function Result({ token }: { token: Promise<string> }) {
  const ok = await confirmSubscription(await token);
  return (
    <>
      <h1 className="text-2xl font-semibold">{ok ? "Suscripción confirmada" : "El enlace no es válido"}</h1>
      <p className="mt-3 text-muted-foreground">
        {ok ? "Recibirás las novedades una vez por semana." : "Puede que ya lo usaras o que haya caducado. Suscríbete de nuevo desde "}
        {!ok && <Link className="underline underline-offset-4" href="/novedades">Novedades</Link>}
      </p>
    </>
  );
}
