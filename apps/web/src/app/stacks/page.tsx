import type { Metadata } from "next";
import Link from "next/link";

import { LANGUAGES } from "@kits/schema";

import { TechIcon } from "@/components/shared/tech-icon";
import { formatCount } from "@/lib/format";
import { getAllEntries } from "@/server/registry";
import { getStacks } from "@/server/stacks";

export const metadata: Metadata = {
  title: "Stacks",
  description: "Combinaciones de tecnologías listas para instalar en un comando: Next.js + Supabase + Stripe, Expo + NativeWind, Hono + Drizzle…",
};

export default async function StacksPage() {
  const [stacks, kits] = await Promise.all([getStacks(), getAllEntries()]);
  const languageOf = (kit: string) => kits.find((k) => k.name === kit)?.language ?? "typescript";
  const languages = LANGUAGES.map((l) => ({
    ...l,
    kits: kits.filter((k) => (k.language ?? "typescript") === l.id).length,
    stacks: stacks.filter((s) => languageOf(s.kit.name) === l.id).length,
  }));
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Stacks</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        Combinaciones probadas de un kit y sus bibliotecas. Cada una se instala con un comando, con sus skills, MCP y reglas para tu agente.
      </p>
      <section className="mt-10 flex flex-col gap-4">
        <h2 className="label-mono">Elige un lenguaje</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {languages.map((l) => (
            <li key={l.id}>
              <Link
                href={`/stacks/lenguaje/${l.id}`}
                className="flex h-full flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 data-[empty=true]:opacity-60"
                data-empty={l.kits === 0}
              >
                <span className="flex items-center gap-3">
                  <TechIcon id={l.id} label={l.label} className="size-6" />
                  <span className="font-semibold">{l.label}</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
                    {l.kits ? `${l.kits} ${l.kits === 1 ? "kit" : "kits"}` : "sin kits"}
                    {l.stacks ? ` · ${l.stacks} stacks` : ""}
                  </span>
                </span>
                <span className="text-sm text-pretty text-muted-foreground">{l.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <h2 className="label-mono mt-14">Todos los stacks</h2>
      <ul className="mt-4 divide-y border-y">
        {stacks.map(({ stack, installs, popular }) => (
          <li key={stack.slug}>
            <Link href={`/stacks/${stack.slug}`} className="flex flex-col gap-1 py-4 hover:bg-muted/50 sm:flex-row sm:items-baseline sm:gap-6 sm:px-2">
              <span className="flex items-center gap-2 font-medium">
                <TechIcon id={languageOf(stack.kit)} label={languageOf(stack.kit)} className="text-muted-foreground" />
                {stack.title}
              </span>
              <span className="flex-1 text-sm text-muted-foreground">{stack.description}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {popular ? "popular · " : ""}
                {formatCount(installs)} inst.
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
