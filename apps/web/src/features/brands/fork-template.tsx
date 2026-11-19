"use client";

import type { BrandProfile } from "@kits/schema";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveBrandAction } from "./actions";

export function ForkTemplate({ owner, draft, templateId, initialName }: {
  owner?: string; draft: BrandProfile; templateId: string; initialName?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName ?? draft.name);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="flex max-w-lg flex-col gap-5" onSubmit={(event) => {
      event.preventDefault();
      setError("");
      const logIn = () => {
        const query = new URLSearchParams({ template: templateId, name });
        router.push("/login?next=" + encodeURIComponent("/brands/new?" + query));
      };
      if (!owner) return logIn();
      start(async () => {
        const result = await saveBrandAction(owner, { ...draft, name });
        if (!result.ok) {
          if (result.error === "Log in first") return logIn();
          return setError(result.error);
        }
        router.replace(`/brands/${result.data}`);
      });
    }}>
      <Field>
        <FieldLabel htmlFor="fork-name">Identifier for your copy</FieldLabel>
        <Input id="fork-name" required pattern="[a-z0-9\-]+" value={name} onChange={(e) => setName(e.target.value)} aria-describedby="fork-hint" />
        <FieldDescription id="fork-hint">Saved in your brands as <code>{owner ?? "your-handle"}/{name}</code>. You can edit its design after creating the copy.</FieldDescription>
      </Field>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="self-start" disabled={pending}>{pending ? "Creating copy…" : owner ? "Create private copy" : "Log in to create private copy"}</Button>
    </form>
  );
}
