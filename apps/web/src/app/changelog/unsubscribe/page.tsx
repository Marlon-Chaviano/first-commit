import type { Metadata } from "next";
import { Suspense } from "react";

import { LinkAction } from "@/features/newsletter/link-action";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

export default function UnsubscribePage({ searchParams }: PageProps<"/changelog/unsubscribe">) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6 sm:py-20">
      <Suspense>
        <Form params={searchParams.then((p) => ({ id: String(p.id ?? ""), sig: String(p.sig ?? "") }))} />
      </Suspense>
    </div>
  );
}

async function Form({ params }: { params: Promise<{ id: string; sig: string }> }) {
  return <LinkAction kind="unsubscribe" fields={await params} />;
}
