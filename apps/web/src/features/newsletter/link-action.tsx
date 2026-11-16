"use client";

import { BRAND } from "@kits/schema/light";
import { CircleCheckIcon, CircleXIcon, LoaderCircleIcon, MailCheckIcon, MailMinusIcon } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { confirmAction, unsubscribeAction, type LinkState } from "./actions";

const COPY = {
  confirm: {
    label: "Newsletter",
    icon: MailCheckIcon,
    title: "One click and you're in",
    body: "Confirm that this email is yours and we'll send you new changelog entries.",
    perks: ["New official kits and libraries", "New features and improvements", "What changed in the CLI and the site"],
    note: "One email per new changelog entry. Unsubscribe in one click.",
    button: "Confirm subscription",
    done: ["You're subscribed", "You'll hear from us when the next changelog entry is published."],
    invalid: ["This link isn't valid", "It was used already or it's more than a week old. Subscribe again from the changelog."],
  },
  unsubscribe: {
    label: "Newsletter",
    icon: MailMinusIcon,
    title: "Unsubscribe from the newsletter",
    body: "You'll stop getting changelog emails. You can subscribe again at any time from the changelog.",
    perks: [],
    note: null,
    button: "Unsubscribe",
    done: ["You've unsubscribed", "You won't get any more emails from us."],
    invalid: ["This link isn't valid", "Use the link from the last email you received."],
  },
} as const;

/** Confirm and unsubscribe pages: the link only opens this page, the button does the change. */
export function LinkAction({ kind, fields }: { kind: keyof typeof COPY; fields: Record<string, string> }) {
  const copy = COPY[kind];
  const [state, action, pending] = useActionState<LinkState, FormData>(kind === "confirm" ? confirmAction : unsubscribeAction, { status: "idle" });
  const Icon = state.status === "done" ? CircleCheckIcon : state.status === "invalid" ? CircleXIcon : copy.icon;
  const [title, body] = state.status === "idle" ? [copy.title, copy.body] : copy[state.status];

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3 sm:px-8">
        <span className="label-mono text-muted-foreground">{copy.label}</span>
        <span className="font-mono text-xs text-muted-foreground">{new URL(BRAND.siteUrl).host}/changelog</span>
      </div>

      <div className="flex flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex size-12 items-center justify-center rounded-lg border bg-background">
          <Icon className="size-6" aria-hidden />
        </div>

        <div className="flex flex-col gap-2" aria-live="polite">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
          <p className="text-pretty text-muted-foreground">{body}</p>
        </div>

        {state.status === "idle" && copy.perks.length > 0 && (
          <ul className="flex flex-col gap-2 border-y py-5 font-mono text-sm">
            {copy.perks.map((perk) => (
              <li key={perk} className="flex gap-3">
                <span className="text-muted-foreground" aria-hidden>
                  +
                </span>
                {perk}
              </li>
            ))}
          </ul>
        )}

        {state.status === "idle" ? (
          <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {Object.entries(fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <Button type="submit" size="lg" variant={kind === "confirm" ? "default" : "outline"} disabled={pending} className="w-full sm:w-fit">
              {pending && <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />}
              {copy.button}
            </Button>
            {copy.note && <p className="text-sm text-muted-foreground">{copy.note}</p>}
          </form>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            {kind === "confirm" && state.status === "done" && (
              <Button size="lg" nativeButton={false} render={<Link href="/" />}>
                Browse kits
              </Button>
            )}
            <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/changelog" />}>
              Go to the changelog
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
