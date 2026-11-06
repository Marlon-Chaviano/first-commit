import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { ConnectedAccounts, DeleteAccount, ProfileForm } from "@/features/account/account-settings";
import { linkedAccounts } from "@/server/accounts";
import { githubLogin, googleLogin } from "@/server/env";
import { getViewer } from "@/server/session";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default function AccountSettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account/settings");
  const linked = await linkedAccounts(viewer.id);
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <h2 className="label-mono">Profile</h2>
        <ProfileForm name={viewer.name} email={viewer.email ?? ""} handle={viewer.handle} />
      </section>
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="label-mono">Connected accounts</h2>
          <p className="text-sm text-muted-foreground">The ways you can sign in. You can revoke access from GitHub or Google at any time too.</p>
        </div>
        <ConnectedAccounts linked={linked} available={{ github: githubLogin, google: googleLogin }} />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="label-mono">Danger zone</h2>
        <DeleteAccount confirmText={viewer.handle ?? viewer.email ?? ""} />
      </section>
    </div>
  );
}
