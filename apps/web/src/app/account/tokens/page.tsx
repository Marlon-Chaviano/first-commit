import { BRAND } from "@kits/schema";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { TokensPanel } from "@/features/account/tokens-panel";
import { getViewer } from "@/server/session";
import { listApiTokens } from "@/server/tokens";

export const metadata: Metadata = { title: "Tokens", robots: { index: false } };

export default function AccountTokensPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="label-mono">Tokens for the CLI and CI</h2>
        <p className="max-w-2xl text-sm text-pretty text-muted-foreground">
          Publish from your terminal or from GitHub Actions with the <code className="font-mono text-foreground">KITS_TOKEN</code> variable. A token is shown
          once; we only keep its hash.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-48" />}>
        <Tokens />
      </Suspense>
    </div>
  );
}

async function Tokens() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account/tokens");
  const tokens = await listApiTokens(viewer.id);
  return (
    <TokensPanel
      loginCommand={`npx ${BRAND.cli} login`}
      tokens={tokens.map((t) => ({ ...t, lastUsedAt: t.lastUsedAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() }))}
    />
  );
}
