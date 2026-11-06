"use client";

import { FlagIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { REPORT_REASONS, reportSchema, type ReportInput } from "@/lib/reports";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

export function ReportDialog({ kit }: { kit: string }) {
  const [reason, setReason] = useState<ReportInput["reason"]>("malicious");
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [errors, setErrors] = useState<Partial<Record<"details" | "contact", string>>>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = reportSchema.safeParse({ kit, reason, details, contact });
    if (!parsed.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as "details" | "contact"] ??= issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't send it");
      setStatus({ kind: "sent" });
    } catch (error) {
      setStatus({ kind: "error", message: (error as Error).message });
    }
  }

  return (
    <Dialog onOpenChange={(open) => open || (status.kind === "sent" && setStatus({ kind: "idle" }))}>
      <DialogTrigger render={<Button variant="destructive" size="sm" className="w-full" />}>
        <FlagIcon data-icon="inline-start" />
        Report this kit
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Denunciar {kit}</DialogTitle>
          <DialogDescription>We review it by hand. If the kit is dangerous, it&apos;s removed from the catalog.</DialogDescription>
        </DialogHeader>
        {status.kind === "sent" ? (
          <>
            <p className="text-sm">Thanks, we got your report.</p>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-6">
            <FieldGroup>
              <FieldSet>
                <FieldLegend variant="label">Reason</FieldLegend>
                <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReportInput["reason"])}>
                  {Object.entries(REPORT_REASONS).map(([value, label]) => (
                    <Field key={value} orientation="horizontal">
                      <RadioGroupItem value={value} id={`reason-${value}`} />
                      <FieldLabel htmlFor={`reason-${value}`} className="font-normal">
                        {label}
                      </FieldLabel>
                    </Field>
                  ))}
                </RadioGroup>
              </FieldSet>
              <Field data-invalid={Boolean(errors.details) || undefined}>
                <FieldLabel htmlFor="report-details">What did you see</FieldLabel>
                <Textarea
                  id="report-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  aria-invalid={Boolean(errors.details) || undefined}
                  rows={4}
                />
                {errors.details && <FieldError>{errors.details}</FieldError>}
              </Field>
              <Field data-invalid={Boolean(errors.contact) || undefined}>
                <FieldLabel htmlFor="report-contact">Contact email (optional)</FieldLabel>
                <Input
                  id="report-contact"
                  type="email"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  aria-invalid={Boolean(errors.contact) || undefined}
                />
                {errors.contact && <FieldError>{errors.contact}</FieldError>}
              </Field>
            </FieldGroup>
            {status.kind === "error" && <p className="text-sm text-destructive">{status.message}</p>}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
              <Button type="submit" disabled={status.kind === "sending"}>
                {status.kind === "sending" ? "Sending…" : "Send report"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
