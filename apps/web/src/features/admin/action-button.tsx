"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Result } from "@/server/action";

import { setKitVerifiedAction, setUserRoleAction } from "./actions";

function ActionButton({ run, done, children, variant = "ghost" }: { run: () => Promise<Result>; done: string; children: React.ReactNode; variant?: "ghost" | "outline" }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await run();
          if (result.ok) toast.success(done);
          else toast.error(result.error);
        })
      }
    >
      {children}
    </Button>
  );
}

export function VerifyKitButton({ slug, verified }: { slug: string; verified: boolean }) {
  return verified ? (
    <ActionButton run={() => setKitVerifiedAction(slug, false)} done={`${slug} is no longer verified`}>
      Unverify
    </ActionButton>
  ) : (
    <ActionButton run={() => setKitVerifiedAction(slug, true)} done={`${slug} verified`} variant="outline">
      Verify
    </ActionButton>
  );
}

export function UserRoleButton({ userId, role }: { userId: string; role: "admin" | "user" }) {
  return role === "admin" ? (
    <ActionButton run={() => setUserRoleAction(userId, "user")} done="Admin role removed">
      Remove admin
    </ActionButton>
  ) : (
    <ActionButton run={() => setUserRoleAction(userId, "admin")} done="Now an admin">
      Make admin
    </ActionButton>
  );
}
