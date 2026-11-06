import { CopyButton } from "./copy-button";

/**
 * A prompt to paste into an agent. The text scrolls on its own (long prompts can be read in full)
 * and a fixed button copies it; the block isn't one big click target, so scrolling isn't blocked.
 */
export function PromptBlock({ text, label = "Copy prompt" }: { text: string; label?: string }) {
  return (
    <div className="relative rounded-lg bg-muted">
      <p
        tabIndex={0}
        className="max-h-80 overflow-y-auto overscroll-contain py-3 pr-12 pl-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-ring"
      >
        {text}
      </p>
      <div className="absolute top-1.5 right-1.5">
        <CopyButton text={text} label={label} />
      </div>
    </div>
  );
}
