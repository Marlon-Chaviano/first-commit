"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

/** A page that failed to render: say so plainly and offer a retry, inside the site's header and footer. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 px-4 py-16 sm:px-6 sm:py-24">
      <Empty className="border">
        <EmptyHeader>
          <p className="label-mono text-muted-foreground">Error</p>
          <EmptyTitle className="text-xl">Something went wrong</EmptyTitle>
          <EmptyDescription>
            This page couldn&apos;t load. Try again in a moment.
            {error.digest && <span className="mt-2 block font-mono text-xs">Reference: {error.digest}</span>}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row flex-wrap justify-center">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
            Go home
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
