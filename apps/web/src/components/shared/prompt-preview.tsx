"use client";

import { CheckIcon, CopyIcon, MaximizeIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { PromptBlock } from "./prompt-block";

/**
 * A prompt in little space: its first lines fading out, a button that copies it and another that
 * opens it in full. For tight spots like the sticky install card, where a tall block would push
 * everything down and scroll inside a scrolling column.
 */
export function PromptPreview({ text, title = "Prompt for your agent" }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex flex-col gap-2">
      <Dialog>
        <DialogTrigger
          render={
            <button
              type="button"
              aria-label="Read the full prompt"
              className="group relative block h-24 overflow-hidden rounded-lg bg-muted px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          }
        >
          <span className="block font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">{text}</span>
          {/* Fades the cut-off text into the block; the label says there's more. */}
          <span className="absolute inset-x-0 bottom-0 flex h-14 items-end justify-center bg-linear-to-t from-muted via-muted/90 to-transparent pb-2">
            <span className="flex items-center gap-1 text-xs font-medium text-foreground opacity-80 transition-opacity group-hover:opacity-100">
              <MaximizeIcon className="size-3" />
              Read the full prompt
            </span>
          </span>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Paste it into Claude Code, Cursor or Codex, in an empty folder.</DialogDescription>
          </DialogHeader>
          <PromptBlock text={text} />
        </DialogContent>
      </Dialog>
      <Button onClick={copy} className="w-full">
        {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
        {copied ? "Copied" : "Copy prompt"}
      </Button>
    </div>
  );
}
