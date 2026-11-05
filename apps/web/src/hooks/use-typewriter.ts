"use client";

import { useEffect, useState } from "react";

/**
 * Types each phrase, holds it, deletes it and moves to the next. Stops (and
 * shows the first phrase whole) while `paused` or when the user prefers
 * reduced motion.
 */
export function useTypewriter(phrases: readonly string[], { paused = false, typeMs = 45, deleteMs = 18, holdMs = 1800 } = {}): string {
  const [text, setText] = useState(phrases[0] ?? "");

  useEffect(() => {
    if (paused || !phrases.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let phrase = 0;
    let length = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = phrases[phrase]!;
      if (!deleting && length < current.length) {
        length++;
        timer = setTimeout(tick, typeMs);
      } else if (!deleting) {
        deleting = true;
        timer = setTimeout(tick, holdMs);
        return;
      } else if (length > 0) {
        length--;
        timer = setTimeout(tick, deleteMs);
      } else {
        deleting = false;
        phrase = (phrase + 1) % phrases.length;
        timer = setTimeout(tick, typeMs * 6);
      }
      setText(phrases[phrase]!.slice(0, length));
    };
    timer = setTimeout(tick, typeMs);
    return () => clearTimeout(timer);
  }, [phrases, paused, typeMs, deleteMs, holdMs]);

  return paused ? (phrases[0] ?? "") : text;
}
