"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { setKitStatusAction } from "./actions";

/** Retire / reactivate (owner) or hide / show (admin). */
export function KitStatusButton({ slug, to, children }: { slug: string; to: "active" | "retired" | "hidden"; children: React.ReactNode }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await setKitStatusAction(slug, to);
          if (!result.ok) toast.error(result.error);
        })
      }
    >
      {children}
    </Button>
  );
}
