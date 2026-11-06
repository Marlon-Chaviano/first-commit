import type { Metadata } from "next";
import Link from "next/link";

import { entryLanguage, LANGUAGES } from "@kits/schema";

import { TechIcon } from "@/components/shared/tech-icon";
import { StackCard, stackLogoKeys } from "@/features/stacks/stack-card";
import { facets } from "@/lib/kit-query";
import { getAllEntries } from "@/server/registry";
import { getStacks } from "@/server/stacks";

export const metadata: Metadata = {
  title: "Stacks",
  description: "Tech combinations ready to install in one command: Next.js + Supabase + Stripe, Expo + NativeWind, Hono + Drizzle…",
};

export default async function StacksPage() {
  const [stacks, kits] = await Promise.all([getStacks(), getAllEntries()]);
  const entryOf = (kit: string) => kits.find((k) => k.name === kit);
  const languages = facets(kits).languages;
  // Stacks grouped by the language of their kit, in catalog order.
  const groups = LANGUAGES.map((language) => ({
    language,
    stacks: stacks.filter((s) => entryLanguage(entryOf(s.kit.name) ?? {}) === language.id),
  })).filter((g) => g.stacks.length);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
      <header className="flex flex-col gap-3">
        <p className="label-mono text-muted-foreground">Stacks</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Proven combinations, one command each</h1>
        <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
          A kit plus the libraries that go well with it. Each stack installs with its skills, MCP servers and the rules your agent follows.
        </p>
      </header>

      <section className="mt-12 flex flex-col gap-4">
        <h2 className="label-mono">Pick a language</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {languages.map((l) => (
            <li key={l.id}>
              <Link
                href={`/stacks/language/${l.id}`}
                className="flex h-full flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 data-[empty=true]:opacity-60"
                data-empty={l.count === 0}
              >
                <span className="flex items-center gap-3">
                  <TechIcon id={l.id} label={l.label} className="size-6" />
                  <span className="font-semibold">{l.label}</span>
                </span>
                <span className="text-sm text-pretty text-muted-foreground">{l.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16 flex flex-col gap-10">
        <h2 className="label-mono">All stacks</h2>
        {groups.map(({ language, stacks: group }) => (
          <div key={language.id} className="flex flex-col gap-4">
            <h3 className="flex items-center gap-2 border-b pb-3 text-sm font-medium">
              <TechIcon id={language.id} label={language.label} className="size-4" />
              {language.label}
            </h3>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
              {group.map(({ stack, kit, installs, popular }) => (
                <li key={stack.slug}>
                  <StackCard
                    slug={stack.slug}
                    title={stack.title}
                    description={stack.description}
                    kit={kit.name}
                    installs={installs}
                    popular={popular}
                    logoKeys={stackLogoKeys(kit.tags, stack.options)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
