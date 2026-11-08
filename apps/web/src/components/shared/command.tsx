import { cn } from "@/lib/utils";

import { CopyButton } from "./copy-button";
import { TypedText } from "./typed-text";

/**
 * A shell command in a muted block, as on skills.sh. Clicking anywhere on it copies the command.
 * `typed`: changes are typed in (the configurator's command, as options change).
 */
export function Command({ command, wrap = false, typed = false, className }: { command: string; wrap?: boolean; typed?: boolean; className?: string }) {
  return (
    <div className={cn("relative flex items-center gap-2 rounded-lg bg-muted py-1.5 pr-1.5 pl-4 transition-colors hover:bg-muted/70", className)}>
      <code className={cn("flex-1 py-1.5 font-mono text-sm", wrap ? "[overflow-wrap:anywhere] whitespace-pre-wrap" : "truncate")}>
        <span className="text-muted-foreground select-none">$ </span>
        {typed ? <TypedText text={command} /> : command}
      </code>
      <CopyButton text={command} label="Copy command" stretch />
    </div>
  );
}
