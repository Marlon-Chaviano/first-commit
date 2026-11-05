"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { addMemberAction, createOrgAction, removeMemberAction, setPolicyAction } from "./actions";

export function CreateOrgForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createOrgAction(slug, name);
          if (r.ok) router.push(`/orgs/${r.data}`);
          else toast.error(r.error);
        });
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="org-slug">Identificador</FieldLabel>
          <Input id="org-slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="acme" className="font-mono" />
          <FieldDescription>Es el espacio de nombres de sus kits: acme/backend. Usa el de tu organización de GitHub.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="org-name">Nombre</FieldLabel>
          <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={pending || !slug}>
        Crear organización
      </Button>
    </form>
  );
}

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
            toast.success("Miembro añadido");
          } else toast.error(r.error);
        });
      }}
    >
      <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="usuario de GitHub" aria-label="Usuario de GitHub" className="font-mono sm:max-w-56" />
      <ToggleGroup variant="outline" size="sm" spacing={1} value={[role]} onValueChange={(v: string[]) => v[0] && setRole(v[0] as typeof role)} aria-label="Rol">
        <ToggleGroupItem value="member" className="font-mono text-xs">miembro</ToggleGroupItem>
        <ToggleGroupItem value="admin" className="font-mono text-xs">admin</ToggleGroupItem>
        {canAddOwners && <ToggleGroupItem value="owner" className="font-mono text-xs">owner</ToggleGroupItem>}
      </ToggleGroup>
      <Button type="submit" size="sm" disabled={pending || !handle.trim()}>
        Añadir
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
          else if (self) router.push("/cuenta");
        })
      }
    >
      {self ? "Salir" : "Quitar"}
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
          if (r.ok) toast.success("Política guardada");
          else toast.error(r.error);
        });
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="policy-required">Obligatorias</FieldLabel>
          <Input id="policy-required" value={req} onChange={(e) => setReq(e.target.value)} placeholder="sentry-nextjs, biome" className="font-mono" disabled={!editable} />
        </Field>
        <Field>
          <FieldLabel htmlFor="policy-forbidden">Prohibidas</FieldLabel>
          <Input id="policy-forbidden" value={forb} onChange={(e) => setForb(e.target.value)} placeholder="mui, chakra" className="font-mono" disabled={!editable} />
          <FieldDescription>Ids del catálogo (/docs/bibliotecas). `doctor` falla si un proyecto de la organización no las cumple.</FieldDescription>
        </Field>
      </FieldGroup>
      {editable && (
        <Button type="submit" variant="outline" disabled={pending} className="self-start">
          Guardar política
        </Button>
      )}
    </form>
  );
}
