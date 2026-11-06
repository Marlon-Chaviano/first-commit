"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { addMemberAction, deleteOrgAction, removeMemberAction, setPolicyAction } from "./actions";

export function AddMemberForm({ org, canAddOwners }: { org: string; canAddOwners: boolean }) {
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState<"member" | "admin" | "owner">("member");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addMemberAction(org, handle, role);
          if (r.ok) {
            setHandle("");
            toast.success("Member added");
          } else toast.error(r.error);
        });
      }}
    >
      <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="GitHub username" aria-label="GitHub username" className="font-mono sm:max-w-56" />
      <ToggleGroup variant="outline" size="sm" spacing={1} value={[role]} onValueChange={(v: string[]) => v[0] && setRole(v[0] as typeof role)} aria-label="Role">
        <ToggleGroupItem value="member" className="font-mono text-xs">member</ToggleGroupItem>
        <ToggleGroupItem value="admin" className="font-mono text-xs">admin</ToggleGroupItem>
        {canAddOwners && <ToggleGroupItem value="owner" className="font-mono text-xs">owner</ToggleGroupItem>}
      </ToggleGroup>
      <Button type="submit" size="sm" disabled={pending || !handle.trim()}>
        Add
      </Button>
    </form>
  );
}

export function RemoveMemberButton({ org, userId, self }: { org: string; userId: string; self: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await removeMemberAction(org, userId);
          if (!r.ok) toast.error(r.error);
          else if (self) router.push("/account");
        })
      }
    >
      {self ? "Leave" : "Remove"}
    </Button>
  );
}

export function PolicyForm({ org, required, forbidden, editable }: { org: string; required: string[]; forbidden: string[]; editable: boolean }) {
  const [req, setReq] = useState(required.join(", "));
  const [forb, setForb] = useState(forbidden.join(", "));
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setPolicyAction(org, req, forb);
          if (r.ok) toast.success("Policy saved");
          else toast.error(r.error);
        });
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="policy-required">Required</FieldLabel>
          <Input id="policy-required" value={req} onChange={(e) => setReq(e.target.value)} placeholder="sentry-nextjs, biome" className="font-mono" disabled={!editable} />
        </Field>
        <Field>
          <FieldLabel htmlFor="policy-forbidden">Forbidden</FieldLabel>
          <Input id="policy-forbidden" value={forb} onChange={(e) => setForb(e.target.value)} placeholder="mui, chakra" className="font-mono" disabled={!editable} />
          <FieldDescription>Catalog ids (/docs/libraries). `doctor` fails when one of the organization&apos;s projects breaks them.</FieldDescription>
        </Field>
      </FieldGroup>
      {editable && (
        <Button type="submit" variant="outline" disabled={pending} className="self-start">
          Save policy
        </Button>
      )}
    </form>
  );
}

/** Owners only: deletes the org with its private kits and brand profiles. */
export function DeleteOrgButton({ org }: { org: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-destructive/40 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium">Delete this organization</h3>
        <p className="text-sm text-pretty text-muted-foreground">Removes its private kits, brand profiles and memberships for everyone. This can&apos;t be undone.</p>
      </div>
      <Button variant="destructive" className="shrink-0" onClick={() => setOpen(true)}>
        Delete organization
      </Button>
      <ConfirmDelete
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${org}?`}
        description="Members lose access to its kits right away, and projects created from them can no longer update."
        confirmText={org}
        button="Delete organization"
        action={async (typed) => {
          const r = await deleteOrgAction(org, typed);
          return r.ok ? { ok: true } : r;
        }}
        onDone={() => {
          toast.success("Organization deleted");
          router.push("/account/orgs");
        }}
      />
    </div>
  );
}
