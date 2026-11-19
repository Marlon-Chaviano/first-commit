import { PlusIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/** Heading and optional actions for an account tab. */
export function TabHeader({ title, description, newHref, newLabel, action }: { title: string; description: string; newHref?: string; newLabel: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="label-mono">{title}</h2>
        <p className="max-w-2xl text-sm text-pretty text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {action}
        {newHref && (
          <Button size="sm" className="shrink-0" nativeButton={false} render={<Link href={newHref as "/"} aria-label={newLabel} />}>
            <PlusIcon data-icon="inline-start" />
            New
          </Button>
        )}
      </div>
    </div>
  );
}
