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
            <FieldLabel>Where</FieldLabel>
            <ToggleGroup variant="outline" size="sm" spacing={1} value={[org]} onValueChange={(v: string[]) => setOrg(v[0] ?? "")} className="flex-wrap">
              <ToggleGroupItem value="" className="font-mono text-xs">public (your user)</ToggleGroupItem>
              {orgs.map((o) => (
                <ToggleGroupItem key={o} value={o} className="font-mono text-xs">{o} (privado)</ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldDescription>In an organization, only its members see and install the kit, and the repository can be private.</FieldDescription>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="repo">GitHub repository</FieldLabel>
          <Input id="repo" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="your-user/your-repo" disabled={Boolean(local)} />
          <FieldDescription>Public, with write access for your account.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="path">kit.json folder</FieldLabel>
          <Input id="path" value={path} onChange={(e) => setPath(e.target.value)} placeholder="kit (empty = root)" disabled={Boolean(local)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="ref">Rama, etiqueta o commit</FieldLabel>
          <Input id="ref" value={ref} onChange={(e) => setRef(e.target.value)} disabled={Boolean(local)} />
          <FieldDescription>It&apos;s pinned to the exact commit: the published version doesn&apos;t change as the repo moves on.</FieldDescription>
        </Field>
        {dev && (
          <Field>
            <FieldLabel htmlFor="local">Local folder (development only)</FieldLabel>
            <Input id="local" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="/absolute/path/to/kit" />
          </Field>
        )}
      </FieldGroup>
      <Button type="submit" disabled={pending || (!repo && !local)}>
        {pending ? "Validating and publishing…" : "Publish"}
      </Button>
      {result?.ok === true && (
        <Alert>
          <AlertTitle>Published: {result.data.slug}@{result.data.version}</AlertTitle>
          <AlertDescription>
            <Link href={`/kits/${result.data.slug}`} className="underline underline-offset-4">
              View the kit page
            </Link>
          </AlertDescription>
        </Alert>
      )}
      {result?.ok === false && (
        <Alert variant="destructive">
          <AlertTitle>Not published</AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
