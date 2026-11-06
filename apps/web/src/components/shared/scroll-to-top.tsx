"use client";

import { useLayoutEffect } from "react";

/**
 * For a Suspense fallback of a whole page. Next.js scrolls a new page to the top only when its first element is out of view;
 * a short skeleton shrinks the document, ends up in view, and the real content then streams in with the old scroll offset.
 */
export function ScrollToTop() {
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  return null;
}
