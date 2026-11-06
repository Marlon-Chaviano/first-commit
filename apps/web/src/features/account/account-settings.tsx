"use client";

import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { TechIcon } from "@/components/shared/tech-icon";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

import { deleteAccountAction } from "./actions";

export function ProfileForm({ name: initial, email, handle }: { name: string; email: string; handle: string | null }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [pending, start] = useTransition();
  const changed = name.trim() !== initial && name.trim().length > 0;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!changed) return;
        start(async () => {
          const { error } = await authClient.updateUser({ name: name.trim() });
          if (error) return void toast.error(error.message ?? "Couldn't save your name");
          toast.success("Name saved");
          router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="profile-name">Name</FieldLabel>
          <Input id="profile-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="profile-email">Email</FieldLabel>
          <Input id="profile-email" value={email} disabled />
          <FieldDescription>From the account you signed in with.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="profile-handle">Username</FieldLabel>
          <Input id="profile-handle" value={handle ?? ""} disabled className="font-mono" />
          <FieldDescription>Your namespace for kits. It comes from GitHub once you link it.</FieldDescription>
        </Field>
      </div>
      <Button type="submit" disabled={!changed || pending} className="w-fit">
        {pending && <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />}
        Save changes
      </Button>
    </form>
  );
}

const PROVIDERS = [
  { id: "github", label: "GitHub", why: "Needed to publish kits: it sets your username and checks repository access." },
  { id: "google", label: "Google", why: "Sign in with your Google account." },
] as const;

/** Link or unlink each sign-in provider. The last one can't be removed, or there would be no way back in. */
export function ConnectedAccounts({ linked, available }: { linked: string[]; available: Record<"github" | "google", boolean> }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const signInMethods = linked.length;
  return (
    <ul className="flex flex-col divide-y rounded-xl border">
      {PROVIDERS.map((p) => {
        const connected = linked.includes(p.id);
        return (
          <li key={p.id} className="flex items-center gap-4 p-4">
            <TechIcon id={p.id} label="" className="size-5 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-2 text-sm font-medium">
                {p.label}
                {connected && (
                  <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                    <CheckIcon className="size-3" />
                    Connected
                  </span>
                )}
              </span>
              <span className="text-xs text-pretty text-muted-foreground">{available[p.id] ? p.why : "Not available on this server."}</span>
            </div>
            {connected ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy !== null || signInMethods <= 1}
                title={signInMethods <= 1 ? "It's your only way to sign in" : undefined}
                onClick={async () => {
                  setBusy(p.id);
                  const { error } = await authClient.unlinkAccount({ providerId: p.id });
                  setBusy(null);
                  if (error) return void toast.error(error.message ?? `Couldn't disconnect ${p.label}`);
                  toast.success(`${p.label} disconnected`);
                  router.refresh();
                }}
              >
                {busy === p.id && <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />}
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={busy !== null || !available[p.id]}
                onClick={async () => {
                  setBusy(p.id);
                  const { error } = await authClient.linkSocial({ provider: p.id, callbackURL: "/account/settings" });
                  if (error) {
                    setBusy(null);
                    toast.error(error.message ?? `Couldn't connect ${p.label}`);
                  }
                }}
              >
                {busy === p.id && <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />}
                Connect
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function DeleteAccount({ confirmText }: { confirmText: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-destructive/40 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium">Delete your account</h3>
        <p className="max-w-xl text-sm text-pretty text-muted-foreground">
          Removes your personal kits, brand profiles, tokens, connected accounts and newsletter subscription. Kits of your organizations stay with them.
          This can&apos;t be undone.
        </p>
      </div>
      <Button variant="destructive" className="shrink-0" onClick={() => setOpen(true)}>
        Delete account
      </Button>
      <ConfirmDelete
        open={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        description="Everything listed is deleted for good. If you're the only owner of an organization, add another owner or delete it first."
        confirmText={confirmText}
        button="Delete my account"
        action={async (typed) => {
          const r = await deleteAccountAction(typed);
          return r.ok ? { ok: true } : r;
        }}
        onDone={async () => {
          // The session row is already gone; this clears the cookie.
          await authClient.signOut().catch(() => undefined);
          toast.success("Your account was deleted");
          router.push("/");
          router.refresh();
        }}
      />
    </div>
  );
}
