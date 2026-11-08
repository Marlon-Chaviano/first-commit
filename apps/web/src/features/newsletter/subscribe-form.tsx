"use client";

import { CircleCheckIcon, LoaderCircleIcon, MailIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";

import { subscribeAction, type SubscribeState } from "./actions";
import type { NewsletterStatus } from "./status";

/** The changelog's newsletter box: the form, or where this browser already stands. */
export function SubscribeForm({ initial = null, email }: { initial?: NewsletterStatus; email?: string }) {
  const [status, setStatus] = useState<NewsletterStatus>(initial);
  const [, action, pending] = useActionState<SubscribeState, FormData>(async (prev, form) => {
    const result = await subscribeAction(prev, form);
    if (result.status === "sent") {
      toast.success("Check your email", { description: "We sent you a link to confirm your subscription." });
      setStatus("pending");
    } else if (result.status === "already") {
      toast.info("You're already subscribed");
      setStatus("confirmed");
    } else if (result.status === "error") {
      toast.error(result.message ?? "Couldn't subscribe");
    }
    return result;
  }, { status: "idle" });

  if (status === "confirmed") {
    return (
      <div className="flex max-w-md items-start gap-3" aria-live="polite">
        <CircleCheckIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="font-medium">You&apos;re subscribed</p>
          <p className="text-sm text-pretty text-muted-foreground">
            The next issue lands on Monday{email ? <> at <span className="font-mono text-foreground">{email}</span></> : null}. Every email has a one-click unsubscribe link.
          </p>
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex max-w-md items-start gap-3" aria-live="polite">
        <MailIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="font-medium">Confirm your email</p>
          <p className="text-sm text-pretty text-muted-foreground">Open the link we sent you to finish subscribing. It&apos;s valid for a week.</p>
          <Button variant="link" className="h-auto w-fit p-0 text-sm" onClick={() => setStatus(null)}>
            Didn&apos;t get it? Send it again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="flex max-w-md flex-col gap-2">
      <InputGroup className="h-10">
        <InputGroupInput type="email" name="email" required defaultValue={email} placeholder="you@email.com" aria-label="Email" className="font-mono text-sm" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="submit" variant="default" size="attached" disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />}
            Subscribe
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <p className="text-sm text-muted-foreground">Once a week: new and featured kits. Unsubscribe in one click.</p>
    </form>
  );
}
