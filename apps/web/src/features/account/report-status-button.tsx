"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { setReportStatusAction } from "./actions";

export function ReportStatusButton({ id, to, children }: { id: string; to: "resolved" | "dismissed" | "open"; children: React.ReactNode }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => start(async () => void ((r) => r.ok || toast.error(r.error))(await setReportStatusAction(id, to)))}
    >
      {children}
    </Button>
  );
}
