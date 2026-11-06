import { AUTHOR, BRAND, REPO_URL } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { BrandName } from "@/components/shared/brand-name";

export const metadata: Metadata = {
  title: "About",
  description: `Why ${BRAND.name} exists and who makes it.`,
};

const PRINCIPLES = [
  ["Your agent, ready from the first commit", "A new project shouldn't start with an hour of setting up skills, rules and MCP. The kit gets everything ready so your agent knows which stack it's working with."],
  ["Official tools, not a fork", "Every kit uses the framework's official command and the libraries as their authors publish them. No templates that go stale."],
  ["Verified, not promised", "Official kits are installed and built with all their combinations on every change. What you see on the site is what works."],
  ["Open and free", "The code, the registry and the official kits are public. Anyone can create and publish their own."],
] as const;

export default function AboutPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 pt-8 sm:px-6 sm:pt-12">
      <header className="flex flex-col gap-4">
        <p className="label-mono text-muted-foreground">Project</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">About <BrandName /></h1>
        <p className="text-lg text-pretty text-muted-foreground">
          <BrandName /> is a registry of kits to start projects: you pick the stack on the website, copy one command and get the project created,
          with its dependencies, the skills for your agent and the stack&apos;s rules in <code className="font-mono text-foreground">AGENTS.md</code>.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PRINCIPLES.map(([title, text]) => (
          <div key={title} className="flex flex-col gap-2 rounded-lg border p-5">
            <h2 className="font-medium">{title}</h2>
            <p className="text-sm text-pretty text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-mono">Who makes it</h2>
        <p className="text-pretty text-muted-foreground">
          It&apos;s built and maintained by{" "}
          <a href={AUTHOR.github} className="text-foreground underline underline-offset-4">
            {AUTHOR.name}
          </a>
          , a developer who got tired of setting up the same things in every new project. It&apos;s an independent project.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button nativeButton={false} render={<a href={REPO_URL} />}>
            View on GitHub
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/contact" />}>
            Contact
          </Button>
        </div>
      </section>
    </div>
  );
}
