"use client";

import { useActionState } from "react";

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";

import { subscribeAction, type SubscribeState } from "./actions";

export function SubscribeForm() {
  const [state, action, pending] = useActionState<SubscribeState, FormData>(subscribeAction, { status: "idle" });
  return (
    <form action={action} className="flex max-w-md flex-col gap-2">
      <InputGroup className="h-10">
        <InputGroupInput type="email" name="email" required placeholder="you@email.com" aria-label="Email" className="font-mono text-sm" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="submit" variant="default" size="attached" disabled={pending}>
            Subscribe
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {state.status === "sent" && "We sent you an email: confirm your subscription from the link."}
        {state.status === "already" && "You're already subscribed."}
        {state.status === "error" && <span className="text-destructive">{state.message}</span>}
        {state.status === "idle" && "Once a week: new and featured kits. Unsubscribe in one click."}
      </p>
    </form>
  );
}
