"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** `stretch`: the button covers its positioned parent, so the whole block copies on click. */
export function CopyButton({ text, label = "Copy", stretch = false }: { text: string; label?: string; stretch?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      className={cn(stretch && "after:absolute after:inset-0 after:rounded-lg after:content-['']")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          toast.error("Couldn't copy: your browser blocked the clipboard");
          return;
        }
        setCopied(true);
        // The icon turns into a check and a toast says it out loud (also for screen readers).
        toast.success("Copied to your clipboard");
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
