import type { Metadata } from "next";
import { Suspense } from "react";

import { LinkAction } from "@/features/newsletter/link-action";

export const metadata: Metadata = { title: "Confirm subscription", robots: { index: false } };

export default function ConfirmPage({ searchParams }: PageProps<"/changelog/confirm">) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6 sm:py-20">
      <Suspense>
        <Form token={searchParams.then((p) => String(p.token ?? ""))} />
      </Suspense>
    </div>
  );
}

async function Form({ token }: { token: Promise<string> }) {
  return <LinkAction kind="confirm" fields={{ token: await token }} />;
}
