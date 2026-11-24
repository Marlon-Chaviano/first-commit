"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";

import { listAvailableBrandsAction, type BrandChoice } from "../brands/actions";

const NONE = "none";

/** Picks a public or shared brand profile for --brand. */
export function BrandPicker({ value, onChange }: { value: string; onChange: (brand: BrandChoice | null) => void }) {
  const { data: session, isPending } = authClient.useSession();
  const [result, setResult] = useState<{ viewer: string | undefined; brands: BrandChoice[] } | null>(null);
  const viewer = session?.user.id;
  const signedIn = Boolean(session);

  useEffect(() => {
    if (isPending) return;
    let live = true;
    listAvailableBrandsAction().then((brands) => live && setResult({ viewer, brands }));
    return () => {
      live = false;
    };
  }, [viewer, isPending]);

  const loading = isPending || !result || result.viewer !== viewer;
  const list = loading ? [] : result.brands;
  const current = list.find((b) => b.slug === value);
  const locked = loading || !list.length;
  const placeholder = loading ? "Loading…" : !list.length ? "No brand profiles yet" : "No brand";

  return (
    <Field>
      <FieldLabel htmlFor="brand">Brand profile</FieldLabel>
      <div className="flex gap-2">
        <Select
          items={[{ value: NONE, label: "No brand" }, ...list.map((b) => ({ value: b.slug, label: b.title }))]}
          value={current ? value : NONE}
          onValueChange={(v) => onChange(list.find((b) => b.slug === v) ?? null)}
          disabled={locked}
        >
          <SelectTrigger id="brand" className="min-w-0 flex-1">
            <SelectValue>{() => (current ? <BrandLabel brand={current} /> : <span className="truncate text-muted-foreground">{placeholder}</span>)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No brand</SelectItem>
            <SelectSeparator />
            {list.map((b) => (
              <SelectItem key={b.slug} value={b.slug}>
                <BrandLabel brand={b} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {loading ? (
          <Skeleton className="h-8 w-20 shrink-0" />
        ) : (
          <Button
            variant="default"
            className="shrink-0"
            nativeButton={false}
            render={<Link href={signedIn ? "/brands/new" : "/login?next=/brands/new"} />}
            aria-label={signedIn ? "Create a brand profile" : "Log in to create a brand profile"}
          >
            <PlusIcon data-icon="inline-start" />
            {signedIn ? "Create" : "Log in"}
          </Button>
        )}
      </div>
    </Field>
  );
}

function BrandLabel({ brand }: { brand: BrandChoice }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {brand.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote brand icon of any host, tiny
        <img src={brand.logo} alt="" className="size-4 shrink-0 rounded-sm object-contain" referrerPolicy="no-referrer" />
      ) : (
        // The swatch is the brand's own color: data, not part of the site's palette.
        <span aria-hidden className="size-3 shrink-0 rounded-full border" style={{ background: brand.primary }} />
      )}
      <span className="truncate">{brand.title} <span className="text-muted-foreground">({brand.slug})</span></span>
    </span>
  );
}
