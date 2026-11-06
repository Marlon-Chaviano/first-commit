import { slugify } from "@kits/schema";
import { LinkIcon } from "lucide-react";
import { isValidElement } from "react";

import { Command } from "@/components/shared/command";
import { CopyButton } from "@/components/shared/copy-button";
import { Separator } from "@/components/ui/separator";

export function DocsHeader({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-4">
      <p className="label-mono text-muted-foreground">Docs</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <div className="text-lg text-muted-foreground">{children}</div>
    </header>
  );
}

/** Plain text of a heading, for its id when the page doesn't give one. */
function textOf(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}


/** Section heading with a stable anchor: hovering shows the link, and the "On this page" rail lists it. */
export function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  const anchor = id ?? slugify(textOf(children));
  return (
    <div className="mt-12 mb-4 flex flex-col gap-3">
      <h2 id={anchor} className="group label-mono scroll-mt-24">
        <a href={`#${anchor}`} className="inline-flex items-center gap-2 outline-none focus-visible:underline">
          {children}
          <LinkIcon aria-hidden className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
        </a>
      </h2>
      <Separator />
    </div>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-muted-foreground">{children}</p>;
}

export function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[0.9em] text-foreground">{children}</code>;
}

export function Cmd({ children }: { children: string }) {
  return <Command command={children} wrap className="mt-3" />;
}

export function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative mt-3">
      <div className="absolute top-2 right-2">
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto rounded-lg bg-muted p-4 pr-12 font-mono text-[12.5px] leading-relaxed">{code}</pre>
    </div>
  );
}

export function Fields({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y">
      {rows.map(([field, text]) => (
        <div key={field} className="grid gap-1 py-3 sm:grid-cols-[200px_1fr] sm:gap-4">
          <dt className="font-mono text-[13px]">{field}</dt>
          <dd className="text-sm text-muted-foreground">{text}</dd>
        </div>
      ))}
    </dl>
  );
}
