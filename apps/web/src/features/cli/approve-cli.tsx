"use client";

import { CheckIcon, LoaderCircleIcon, TerminalIcon, XIcon } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { decideCliLoginAction, type DecideState } from "./actions";

/** Compare the code with the terminal, then authorize. The result tells the person what happens next. */
export function ApproveCli({ code, device, handle }: { code: string; device: string; handle: string }) {
  const [state, action, pending] = useActionState<DecideState, FormData>(decideCliLoginAction, { status: "idle" });

  if (state.status === "approved") {
    return (
      <Result icon={<CheckIcon className="size-5" />} title="The CLI is logged in">
        Go back to your terminal: it continues on its own as <span className="font-mono text-foreground">@{handle}</span>. You can close this tab.
      </Result>
    );
  }
  if (state.status === "denied") {
    return (
      <Result icon={<XIcon className="size-5" />} title="Login denied">
        The terminal won&apos;t get access. If you didn&apos;t start it, nothing else is needed.
      </Result>
    );
  }
  if (state.status === "invalid") {
    return (
      <Result icon={<XIcon className="size-5" />} title="This code isn't valid anymore">
        It expired or was already used. Run <code className="font-mono text-foreground">login</code> again in your terminal.
      </Result>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="code" value={code} />
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Authorize the CLI</h1>
        <p className="text-sm text-pretty text-muted-foreground">
          A terminal wants to publish and read your private kits as <span className="font-mono text-foreground">@{handle}</span>.
        </p>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-lg bg-muted px-4 py-5">
        <span className="font-mono text-3xl font-semibold tracking-[0.2em] tabular-nums">{code}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <TerminalIcon className="size-3.5" />
          {device}
        </span>
      </div>
      <p className="text-sm text-pretty text-muted-foreground">Check that it&apos;s the same code your terminal shows. Never authorize a code someone sent you.</p>
      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" name="decision" value="approve" disabled={pending} className="sm:flex-1">
          {pending && <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />}
          Authorize
        </Button>
        <Button type="submit" name="decision" value="deny" variant="outline" disabled={pending} className="sm:flex-1">
          Deny
        </Button>
      </div>
    </form>
  );
}

function Result({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3" role="status">
      {icon}
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-pretty text-muted-foreground">{children}</p>
    </div>
  );
}
