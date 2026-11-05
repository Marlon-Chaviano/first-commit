"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const PAGES = [
  { href: "/docs", label: "Crear un kit" },
  { href: "/docs/referencia", label: "Referencia de kit.json" },
  { href: "/docs/bibliotecas", label: "Catálogo de bibliotecas" },
  { href: "/docs/mantener", label: "Mantener tu proyecto" },
  { href: "/docs/agentes", label: "Desde tu agente" },
  { href: "/docs/marcas", label: "Perfiles de marca" },
];

export function DocsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-4 overflow-x-auto font-mono text-sm md:flex-col md:gap-2">
      {PAGES.map((page) => (
        <Link
          key={page.href}
          href={page.href}
          aria-current={pathname === page.href ? "page" : undefined}
          className={cn(
            "shrink-0 text-muted-foreground transition-colors hover:text-foreground",
            pathname === page.href && "text-foreground",
          )}
        >
          {page.label}
        </Link>
      ))}
    </nav>
  );
}
