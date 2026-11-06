import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountTabs } from "@/features/account/account-tabs";
import { getViewer } from "@/server/session";

/** The account area: who you are, then one tab per page (kits, tokens, organizations, brands, settings). */
export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <div className="flex flex-col gap-6">
        <Suspense fallback={<HeaderSkeleton />}>
          <AccountHeader />
        </Suspense>
        <AccountTabs />
      </div>
      {children}
    </div>
  );
}

async function AccountHeader() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account");
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <UserAvatar name={viewer.name || viewer.handle || "?"} image={viewer.image} size="lg" className="size-14" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{viewer.name || viewer.handle}</h1>
          <p className="truncate font-mono text-sm text-muted-foreground">
            {viewer.handle && <>@{viewer.handle} · </>}
            {viewer.email}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {viewer.handle && (
          <Button variant="outline" nativeButton={false} render={<Link href={`/u/${viewer.handle}`} />}>
            Public profile
            <ArrowUpRightIcon data-icon="inline-end" />
          </Button>
        )}
        <Button nativeButton={false} render={<Link href="/publish" />}>
          Publish a kit
        </Button>
      </div>
    </header>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex items-center gap-4">
      <Skeleton className="size-14 rounded-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  );
}
