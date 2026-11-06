"use client";

import { CheckIcon, LoaderCircleIcon, SendIcon } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { sendContactAction, type ContactState } from "./actions";

const MAX = 5000;

export function ContactForm({ email: defaultEmail }: { email?: string }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContactAction, { status: "idle" });
  const [length, setLength] = useState(0);

  if (state.status === "sent") {
    return (
      <div className="flex flex-col items-start gap-2 rounded-xl border p-6" role="status">
        <CheckIcon className="size-5" />
        <p className="font-medium">Message sent</p>
        <p className="text-sm text-muted-foreground">Thanks. I&apos;ll reply to your email, usually within a day or two.</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border p-5 sm:p-6">
      {/* Honeypot for bots: hidden from people and from assistive tech. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="contact-email">Your email</FieldLabel>
          <Input id="contact-email" name="email" type="email" required autoComplete="email" defaultValue={defaultEmail} placeholder="you@email.com" className="h-10" />
        </Field>
        <Field>
          <FieldLabel htmlFor="contact-subject">Subject</FieldLabel>
          <Input id="contact-subject" name="subject" required minLength={3} maxLength={120} placeholder="What's it about?" className="h-10" />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="contact-message">Message</FieldLabel>
        <Textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={MAX}
          rows={6}
          placeholder="Tell me what you need, what you found or what you'd like to see."
          onChange={(e) => setLength(e.target.value.length)}
        />
      </Field>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {state.status === "error" ? <span className="text-destructive">{state.message}</span> : <span className="font-mono text-xs tabular-nums">{length.toLocaleString("en")} / {MAX.toLocaleString("en")}</span>}
        </p>
        <Button type="submit" disabled={pending} className="sm:w-fit">
          {pending ? <LoaderCircleIcon className="animate-spin" data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
          {pending ? "Sending…" : "Send message"}
        </Button>
      </div>
    </form>
  );
}
