"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { publishAction } from "./actions";

export function PublishForm({ dev, orgs = [] }: { dev: boolean; orgs?: string[] }) {
  const [org, setOrg] = useState("");
  const [repo, setRepo] = useState("");
  const [path, setPath] = useState("");
  const [ref, setRef] = useState("main");
  const [local, setLocal] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof publishAction>> | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setResult(await publishAction({ ...(local ? { local } : { repo, path, ref }), ...(org ? { org } : {}) })));
      }}
    >
      <FieldGroup>
        {orgs.length > 0 && (
          <Field>
            <FieldLabel>Dónde</FieldLabel>
            <ToggleGroup variant="outline" size="sm" spacing={1} value={[org]} onValueChange={(v: string[]) => setOrg(v[0] ?? "")} className="flex-wrap">
              <ToggleGroupItem value="" className="font-mono text-xs">público (tu usuario)</ToggleGroupItem>
              {orgs.map((o) => (
                <ToggleGroupItem key={o} value={o} className="font-mono text-xs">{o} (privado)</ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldDescription>En una organización, el kit solo lo ven y lo instalan sus miembros, y el repositorio puede ser privado.</FieldDescription>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="repo">Repositorio de GitHub</FieldLabel>
          <Input id="repo" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="tu-usuario/tu-repo" disabled={Boolean(local)} />
          <FieldDescription>Público, y con permiso de escritura para tu cuenta.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="path">Carpeta del kit.json</FieldLabel>
          <Input id="path" value={path} onChange={(e) => setPath(e.target.value)} placeholder="kit (vacío = raíz)" disabled={Boolean(local)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="ref">Rama, etiqueta o commit</FieldLabel>
          <Input id="ref" value={ref} onChange={(e) => setRef(e.target.value)} disabled={Boolean(local)} />
          <FieldDescription>Se fija al commit exacto: la versión publicada no cambia aunque el repo siga avanzando.</FieldDescription>
        </Field>
        {dev && (
          <Field>
            <FieldLabel htmlFor="local">Carpeta local (solo en desarrollo)</FieldLabel>
            <Input id="local" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="/ruta/absoluta/al/kit" />
          </Field>
        )}
      </FieldGroup>
      <Button type="submit" disabled={pending || (!repo && !local)}>
        {pending ? "Validando y publicando…" : "Publicar"}
      </Button>
      {result?.ok === true && (
        <Alert>
          <AlertTitle>Publicado: {result.data.slug}@{result.data.version}</AlertTitle>
          <AlertDescription>
            <Link href={`/kits/${result.data.slug}`} className="underline underline-offset-4">
              Ver la página del kit
            </Link>
          </AlertDescription>
        </Alert>
      )}
      {result?.ok === false && (
        <Alert variant="destructive">
          <AlertTitle>No se publicó</AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
