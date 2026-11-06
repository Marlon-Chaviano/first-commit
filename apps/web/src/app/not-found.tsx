import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 px-4 py-16 sm:px-6 sm:py-24">
      <Empty className="border">
        <EmptyHeader>
          <p className="label-mono text-muted-foreground">404</p>
          <EmptyTitle className="text-xl">This page doesn&apos;t exist</EmptyTitle>
          <EmptyDescription>The link may be old, or the kit was renamed or retired.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row flex-wrap justify-center">
          <Button nativeButton={false} render={<Link href="/" />}>
            Browse kits
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/docs" />}>
            Read the docs
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
