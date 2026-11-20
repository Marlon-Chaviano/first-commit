"use client";

import { BRAND, REPO_URL } from "@kits/schema/light";
import { StarIcon, XIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const storageKey = `${BRAND.name}:star-prompt-dismissed`;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function wasDismissed() {
  try {
    return localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

export function StarPrompt() {
  const pathname = usePathname();
  const [closed, setClosed] = useState(false);
  const dismissed = useSyncExternalStore(subscribe, wasDismissed, () => true);
  const kitPage = pathname.startsWith("/kits/");
  if (closed || dismissed || !(pathname === "/" || kitPage || pathname.startsWith("/stacks"))) return null;

  function dismiss() {
    setClosed(true);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // Closing still works when the browser blocks storage.
    }
  }

  return (
    <div
      lang="es"
      className={cn(
        "fixed right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 flex items-center rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-sm sm:right-5",
        kitPage && "max-lg:bottom-[calc(5rem+env(safe-area-inset-bottom))]",
      )}
    >
      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        className={cn(buttonVariants({ variant: "ghost" }), "h-auto gap-2.5 px-2 py-1 text-left")}
        onClick={dismiss}
      >
        <StarIcon aria-hidden className="size-4 transition-colors group-hover/button:fill-current" />
        <span className="flex flex-col">
          <span className="text-xs font-normal text-muted-foreground">¿Te gusta el proyecto?</span>
          <span className="text-sm leading-4">Danos una estrella<span className="sr-only"> en GitHub</span></span>
        </span>
      </a>
      <Button variant="ghost" size="icon-sm" aria-label="Cerrar aviso" onClick={dismiss} className="text-muted-foreground">
        <XIcon className="size-3.5" />
      </Button>
    </div>
  );
}
