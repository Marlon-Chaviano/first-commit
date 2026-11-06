import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Title of an account tab. The "New" button only shows once the list has items:
 * an empty list already has its own call to action in the empty state.
 */
export function TabHeader({ title, description, newHref, newLabel }: { title: string; description: string; newHref?: string; newLabel: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="label-mono">{title}</h2>
        <p className="max-w-2xl text-sm text-pretty text-muted-foreground">{description}</p>
      </div>
      {newHref && (
        <Button size="sm" className="shrink-0" nativeButton={false} render={<Link href={newHref as "/"} aria-label={newLabel} />}>
          <PlusIcon data-icon="inline-start" />
          New
        </Button>
      )}
    </div>
  );
}
