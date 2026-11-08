import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

// "404" in the Banner3 figlet font, drawn with full blocks only so every glyph has the same width.
const ASCII_404 = String.raw`
██            █████     ██
██    ██     ██   ██    ██    ██
██    ██    ██     ██   ██    ██
██    ██    ██     ██   ██    ██
█████████   ██     ██   █████████
      ██     ██   ██          ██
      ██      █████           ██`.slice(1);

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-4 py-16 text-center sm:px-6 sm:py-24">
      <pre
        role="img"
        aria-label="404"
        className="text-left font-mono text-[clamp(0.6rem,3.4vw,1.5rem)] leading-none select-none"
      >
        {ASCII_404}
      </pre>

      <div className="flex flex-col items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">This page doesn&apos;t exist</h1>
        <p className="max-w-md text-pretty text-muted-foreground">The link may be old, or the kit was renamed or retired.</p>
      </div>

      <div className="w-full max-w-md overflow-hidden rounded-lg border bg-card text-left font-mono text-sm">
        <div className="flex items-center gap-1.5 border-b px-3 py-2" aria-hidden>
          <span className="size-2.5 rounded-full border" />
          <span className="size-2.5 rounded-full border" />
          <span className="size-2.5 rounded-full border" />
        </div>
        <div className="flex flex-col gap-1 p-4">
          <p>
            <span className="text-muted-foreground">$</span> git checkout this-page
          </p>
          <p className="text-muted-foreground">error: pathspec &apos;this-page&apos; did not match any file known to git</p>
          <p>
            <span className="text-muted-foreground">$</span> <span className="animate-pulse">▍</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button size="lg" nativeButton={false} render={<Link href="/" />}>
          Browse kits
        </Button>
        <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/docs" />}>
          Read the docs
        </Button>
      </div>
    </div>
  );
}
