"use client";

import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { TechIcon } from "@/components/shared/tech-icon";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

const WHY = ["Your GitHub username becomes your namespace: your-user/kit", "Publishing checks you can access the kit's repository", "Your GitHub avatar is used if you don't have one"];

/** For accounts without GitHub (Google or dev login): publishing needs it to check repo permissions. */
export function LinkGithub({ enabled, back = "/account/kits" }: { enabled: boolean; back?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <section className="flex flex-col gap-5 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex gap-4">
        <TechIcon id="github" label="" className="mt-0.5 size-6 shrink-0" />
        <div className="flex flex-col gap-2">
          <h2 className="font-medium">Link GitHub to publish kits</h2>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {WHY.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-foreground" />
                {line}
              </li>
            ))}
          </ul>
          {!enabled && <p className="text-xs text-muted-foreground">Available once deployed: the GitHub sign-in app isn&apos;t configured here.</p>}
        </div>
      </div>
      <Button
        className="shrink-0 sm:self-center"
        disabled={!enabled || pending}
        onClick={async () => {
          setPending(true);
          const { error } = await authClient.linkSocial({ provider: "github", callbackURL: back });
          if (error) {
            setPending(false);
            toast.error(error.message ?? "Couldn't link GitHub");
          }
        }}
      >
        {pending ? <LoaderCircleIcon className="animate-spin" data-icon="inline-start" /> : <TechIcon id="github" label="" className="size-4" />}
        Link GitHub
      </Button>
    </section>
  );
}
