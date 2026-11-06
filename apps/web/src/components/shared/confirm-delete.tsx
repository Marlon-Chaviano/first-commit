"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Irreversible actions: the person types the name of what they're deleting before the button unlocks.
 * Controlled, so a menu item or a button can open it.
 */
export function ConfirmDelete({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  action,
  onDone,
  button = "Delete",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmText: string;
  action: (typed: string) => Promise<Result>;
  onDone: () => void;
  button?: string;
}) {
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const matches = typed.trim() === confirmText;
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (!matches) return;
            start(async () => {
              const r = await action(typed);
              if (!r.ok) return void toast.error(r.error);
              onOpenChange(false);
              onDone();
            });
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor="confirm-delete">
              Type <code className="font-mono text-foreground">{confirmText}</code> to confirm
            </FieldLabel>
            <Input id="confirm-delete" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} className="font-mono" />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={!matches || pending}>
              {pending && <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />}
              {button}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
