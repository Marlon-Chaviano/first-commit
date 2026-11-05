import { cliCommand } from "@kits/schema";
import Link from "next/link";

import { Separator } from "@/components/ui/separator";
import { billingEnabled } from "@/server/stripe";

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-24 w-full max-w-5xl px-4 pb-10 sm:px-6">
      <Separator />
      <div className="flex flex-col gap-2 pt-6 font-mono text-xs text-muted-foreground sm:flex-row sm:justify-between">
        <p>
          Los skills vienen de{" "}
          <a href="https://skills.sh" className="underline underline-offset-4 hover:text-foreground">
            skills.sh
          </a>
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          {[
            ...(billingEnabled ? [["/precios", "Precios"]] : []),
            ["/novedades", "Novedades"],
            ["/docs", "Crear un kit"],
            ["/terminos", "Términos"],
            ["/privacidad", "Privacidad"],
            ["/contenido", "Contenido"],
          ].map(([href, label]) => (
            <Link key={href} href={href!} className="hover:text-foreground">
              {label}
            </Link>
          ))}
          <span>{cliCommand("list")}</span>
        </nav>
      </div>
    </footer>
  );
}
