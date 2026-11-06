"use client";

import { useState, useTransition } from "react";

import { Command } from "@/components/shared/command";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { createTokenAction, revokeTokenAction } from "./actions";

export interface TokenRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export function TokensPanel({ tokens, loginCommand }: { tokens: TokenRow[]; loginCommand: string }) {
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const result = await createTokenAction(name);
            if (result.ok) {
              setCreated(result.data);
              setName("");
              setError(null);
            } else setError(result.error);
          });
        }}
      >
        <Field className="flex-1">
          <FieldLabel htmlFor="token-name">New token</FieldLabel>
          <Input id="token-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My laptop, GitHub Actions…" maxLength={60} />
        </Field>
        <Button type="submit" disabled={pending}>
          Create
        </Button>
      </form>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {created && (
        <Alert>
          <AlertDescription className="flex flex-col gap-2">
            <span>Copy it now: it won&apos;t be shown again. Then run:</span>
            <Command command={`${loginCommand} --token ${created}`} wrap />
          </AlertDescription>
        </Alert>
      )}
      {tokens.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="label-mono text-muted-foreground">Name</TableHead>
              <TableHead className="label-mono text-muted-foreground">Token</TableHead>
              <TableHead className="label-mono text-muted-foreground">Last used</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{t.prefix}…</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{t.lastUsedAt?.slice(0, 10) ?? "nunca"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => void (await revokeTokenAction(t.id)))}>
                    Revoke
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
