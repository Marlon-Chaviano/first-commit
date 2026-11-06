"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Heading = { id: string; text: string };

/** "On this page": the article's section headings, with the one being read highlighted. */
export function DocsToc() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string>();

  useEffect(() => {
    // Pages visited earlier stay in the DOM, hidden by <Activity>: only the visible page's headings count.
    const nodes = [...document.querySelectorAll<HTMLHeadingElement>("[data-docs-article] h2[id]")].filter((n) => n.checkVisibility());
    let frame = 0;
    // The current section is the last heading that has scrolled past the sticky header.
    const update = () => {
      frame = 0;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const passed = nodes.filter((n) => n.getBoundingClientRect().top <= 120);
      setActive((atBottom ? nodes.at(-1) : passed.at(-1))?.id ?? nodes[0]?.id);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // Read after the new page has painted, not during the effect.
    frame = requestAnimationFrame(() => {
      setHeadings(nodes.map((n) => ({ id: n.id, text: n.textContent ?? "" })));
      update();
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  if (headings.length < 2) return null;
  return (
    <nav aria-label="On this page" className="flex flex-col gap-3">
      <p className="label-mono text-foreground">On this page</p>
      <ul className="flex flex-col border-l">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              aria-current={active === h.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l py-1 pl-3 text-[13px] text-muted-foreground transition-colors hover:text-foreground",
                active === h.id ? "border-foreground text-foreground" : "border-transparent",
              )}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
