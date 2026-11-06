import { cliCommand } from "@kits/schema";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { ApproveCli } from "@/features/cli/approve-cli";
import { findCliLogin, normalizeCode } from "@/server/cli-login";
import { getViewer } from "@/server/session";

export const metadata: Metadata = { title: "Authorize the CLI", robots: { index: false } };

/** Opened by `create-first-commit login`: the signed-in person approves the code shown in the terminal. */
export default function CliLoginPage({ searchParams }: PageProps<"/cli/login">) {
  return (
    <div className="grid min-h-[calc(100dvh-14rem)] place-items-center px-4 py-12">
      <section className="w-full max-w-sm rounded-xl border bg-card p-6 sm:p-8">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <Approval code={searchParams.then((p) => String(p.code ?? ""))} />
        </Suspense>
      </section>
    </div>
  );
}

async function Approval({ code: codePromise }: { code: Promise<string> }) {
  const raw = await codePromise;
  const code = normalizeCode(raw);
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/cli/login?code=${code ?? raw}`)}`);
  const request = code ? await findCliLogin(code) : null;
  if (!request || request.status !== "pending") {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold tracking-tight">This code isn&apos;t valid anymore</h1>
        <p className="text-sm text-pretty text-muted-foreground">
          Codes last 10 minutes and work once. Run <code className="font-mono text-foreground">{cliCommand("login")}</code> again in your terminal.
        </p>
      </div>
    );
  }
  return <ApproveCli code={request.code} device={request.device} handle={viewer.handle ?? viewer.name} />;
}
