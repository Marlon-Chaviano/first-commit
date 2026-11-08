"use client";

import { CheckIcon, LoaderCircleIcon, MailIcon } from "lucide-react";
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

  if (status === "confirmed") return <SubscribedCard email={email} />;

  return (
    <section aria-labelledby="newsletter" className="grid grid-cols-1 gap-4 rounded-xl border p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] md:items-center md:gap-10">
      <div className="flex flex-col gap-1.5">
        <h2 id="newsletter" className="font-medium">Get it in your inbox</h2>
        <p className="text-sm text-pretty text-muted-foreground">A short weekly email with what changed here and the community&apos;s best new kits.</p>
      </div>

      {status === "pending" ? (
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
      ) : (
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
      )}
    </section>
  );
}

/** Same footprint as the form: the box doesn't jump when someone subscribes. */
function SubscribedCard({ email }: { email?: string }) {
  return (
    <section
      aria-labelledby="newsletter"
      aria-live="polite"
      className="grid grid-cols-1 gap-4 rounded-xl border p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-10"
    >
      <div className="flex items-start gap-3.5">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
          <CheckIcon className="size-4" strokeWidth={2.5} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="newsletter" className="font-medium">You&apos;re subscribed</h2>
          <p className="text-sm text-pretty text-muted-foreground">Every Monday: what changed here and the best new kits. Unsubscribe from any email.</p>
        </div>
      </div>
      {email && (
        <dl className="flex min-w-0 flex-col gap-0.5 border-t pt-4 md:items-end md:border-t-0 md:pt-0">
          <dt className="text-xs text-muted-foreground">Sending to</dt>
          <dd className="truncate font-mono text-sm">{email}</dd>
        </dl>
      )}
    </section>
  );
}
