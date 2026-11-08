"use client";

import { useEffect, useRef } from "react";

/**
 * Text that "types" its changes: when `text` changes, the part both versions share stays and the
 * rest is typed in (about 250 ms), like the terminal would. The first render is plain text, so the
 * HTML has it; with reduced motion it just swaps.
 */
export function TypedText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(text);

  useEffect(() => {
    const el = ref.current;
    const from = shown.current;
    if (!el || from === text) return;
    shown.current = text;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = text;
      return;
    }
    let common = 0;
    while (common < from.length && common < text.length && from[common] === text[common]) common++;
    const rest = text.length - common;
    const started = performance.now();
    const duration = Math.min(320, 60 + rest * 12);
    let frame = requestAnimationFrame(function step(now) {
      const typed = Math.ceil(Math.min(1, (now - started) / duration) * rest);
      el.textContent = text.slice(0, common + typed);
      if (typed < rest) frame = requestAnimationFrame(step);
    });
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = text;
    };
  }, [text]);

  // The children never change after the first render: the effect owns the text from then on.
  return <span ref={ref}>{shown.current}</span>;
}
