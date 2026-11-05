"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { setKitFeaturedAction } from "./actions";

/** Admin: feature a community kit on the home page and in the newsletter. */
export function FeaturedButton({ slug, featured }: { slug: string; featured: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await setKitFeaturedAction(slug, !featured);
          if (!result.ok) toast.error(result.error);
        })
      }
    >
      {featured ? "Quitar de destacados" : "Destacar"}
    </Button>
  );
}
