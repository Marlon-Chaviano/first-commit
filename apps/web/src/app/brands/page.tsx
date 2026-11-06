import { cliCommand } from "@kits/schema";
import { FileTextIcon, PaletteIcon, PlusIcon, TypeIcon, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Command } from "@/components/shared/command";
import { Button } from "@/components/ui/button";
import { BrandsBody } from "@/features/brands/brand-list";
import { listBrands } from "@/server/brands";
import { getViewer } from "@/server/session";

export const metadata: Metadata = {
  title: "Brand profiles",
  description: "Save a client's or your company's colors, fonts, interface rules and docs, and apply them to any kit with --brand.",
};

const PARTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: PaletteIcon, title: "Colors and radius", text: "Light and dark tokens, written as CSS variables and design tokens in every project." },
  { icon: TypeIcon, title: "Fonts and voice", text: "Body and heading fonts, plus how the product talks, for the agent's copy." },
  { icon: FileTextIcon, title: "Rules and guide", text: "Interface rules and your style guide, added to AGENTS.md so the agent follows them." },
];

/** Always in the nav. Signed in, your profiles right here; signed out, what they are and a way to log in. */
export default function BrandsPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <Suspense fallback={<Header />}>
        <Content />
      </Suspense>
    </div>
  );
}

/** One title for the page; signed in with profiles, the "New" button sits next to it. */
function Header({ action }: { action?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Brand profiles</h1>
        <p className="text-lg text-pretty text-muted-foreground">
          A client&apos;s or your company&apos;s identity, saved once. Add <code className="font-mono text-foreground">--brand</code> when creating a project
          and the agent starts with its colors, fonts, logo and rules.
        </p>
      </div>
      {action}
    </header>
  );
}

async function Content() {
  const viewer = await getViewer();
  if (viewer) {
    const brands = await listBrands(viewer);
    return (
      <>
        <Header
          action={
            // An empty list has its own call to action in the empty state.
            brands.length > 0 && (
              <Button size="lg" className="shrink-0 self-start sm:self-end" nativeButton={false} render={<Link href="/brands/new" />}>
                <PlusIcon data-icon="inline-start" />
                New
              </Button>
            )
          }
        />
        <div className="flex flex-col gap-6">
          <BrandsBody brands={brands} />
        </div>
      </>
    );
  }
  return (
    <>
      <Header />
    <div className="flex flex-col gap-10">
      <ul className="grid gap-4 sm:grid-cols-3">
        {PARTS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex flex-col gap-2 rounded-xl border p-5">
            <Icon className="size-5" />
            <h2 className="font-medium">{title}</h2>
            <p className="text-sm text-pretty text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
      <Command command={cliCommand("landing-next my-site --brand acme/web")} className="w-fit max-w-full" />
      <section className="flex flex-col items-start gap-4 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="font-medium">Log in to create brand profiles</h2>
          <p className="text-sm text-pretty text-muted-foreground">Profiles are private: only you, or the members of your organization, can use them.</p>
        </div>
        <Button className="shrink-0" nativeButton={false} render={<Link href="/login?next=/brands" />}>
          Log in to continue
        </Button>
      </section>
    </div>
    </>
  );
}
