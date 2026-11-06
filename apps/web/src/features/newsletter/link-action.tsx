"use client";

import { LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { confirmAction, unsubscribeAction, type LinkState } from "./actions";

const COPY = {
  confirm: {
    title: "Confirm your subscription",
    body: "One email a week: new kits, community highlights and what's new. Nothing else.",
    button: "Confirm subscription",
    done: ["Subscription confirmed", "You'll get the first email next week."],
    invalid: ["This link isn't valid", "It was used already or it's more than a week old. Subscribe again from the changelog."],
  },
  unsubscribe: {
    title: "Unsubscribe from the newsletter",
    body: "You'll stop getting the weekly email. You can subscribe again at any time.",
    button: "Unsubscribe",
    done: ["You've unsubscribed", "You won't get any more emails."],
    invalid: ["This link isn't valid", "Use the link from the last email you received."],
  },
} as const;

/** Confirm and unsubscribe pages: the link only opens this page, the button does the change. */
export function LinkAction({ kind, fields }: { kind: keyof typeof COPY; fields: Record<string, string> }) {
  const copy = COPY[kind];
  const [state, action, pending] = useActionState<LinkState, FormData>(kind === "confirm" ? confirmAction : unsubscribeAction, { status: "idle" });
  const [title, body] = state.status === "idle" ? [copy.title, copy.body] : copy[state.status];
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-pretty text-muted-foreground" aria-live="polite">{body}</p>
      {state.status === "idle" ? (
        <form action={action} className="mt-3">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <Button type="submit" variant={kind === "confirm" ? "default" : "outline"} disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />}
            {copy.button}
          </Button>
        </form>
      ) : (
        <Button variant="outline" className="mt-3 w-fit" nativeButton={false} render={<Link href="/changelog" />}>
          Go to the changelog
        </Button>
      )}
    </div>
  );
}
