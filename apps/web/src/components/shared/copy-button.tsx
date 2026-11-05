"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** `stretch`: the button covers its positioned parent, so the whole block copies on click. */
export function CopyButton({ text, label = "Copiar", stretch = false }: { text: string; label?: string; stretch?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={copied ? "Copiado" : label}
      title={copied ? "Copiado" : label}
      className={cn(stretch && "after:absolute after:inset-0 after:rounded-lg after:content-['']")}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
