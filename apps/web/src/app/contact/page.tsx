import { AUTHOR, BRAND, REPO_URL } from "@kits/schema";
import { BugIcon, MailIcon, MessagesSquareIcon, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ContactForm } from "@/features/contact/contact-form";
import { getViewer } from "@/server/session";

export const metadata: Metadata = {
  title: "Contact",
  description: `How to reach ${BRAND.name}: email, bugs and ideas.`,
};

const CHANNELS: { icon: LucideIcon; title: string; text: string; href: string; cta: string }[] = [
  { icon: MailIcon, title: "Email", text: "Questions, collaborations, kits for your company or anything else.", href: `mailto:${AUTHOR.email}`, cta: AUTHOR.email },
  { icon: BugIcon, title: "Bugs", text: "A kit that doesn't build, a command that fails or something that looks off.", href: `${REPO_URL}/issues/new`, cta: "Open an issue" },
  { icon: MessagesSquareIcon, title: "Ideas and kits", text: "Suggest a kit, a library for the catalog or an improvement.", href: `${REPO_URL}/discussions`, cta: "Go to Discussions" },
];

export default function ContactPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 pt-8 sm:px-6 sm:pt-12">
      <header className="flex flex-col gap-4">
        <p className="label-mono text-muted-foreground">Project</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Contact</h1>
        <p className="text-lg text-pretty text-muted-foreground">I reply personally, usually within a day or two.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        {CHANNELS.map(({ icon: Icon, title, text, href, cta }) => (
          <a key={title} href={href} className="group flex flex-col gap-3 rounded-lg border p-5 transition-colors hover:bg-muted/40">
            <Icon className="size-5" />
            <div className="flex flex-col gap-1">
              <h2 className="font-medium">{title}</h2>
              <p className="text-sm text-pretty text-muted-foreground">{text}</p>
            </div>
            <span className="mt-auto truncate font-mono text-xs underline-offset-4 group-hover:underline">{cta}</span>
          </a>
        ))}
      </div>
      <section aria-labelledby="quick-message" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 id="quick-message" className="label-mono">Quick message</h2>
          <p className="text-sm text-muted-foreground">Goes straight to my inbox. Your email is used only to reply.</p>
        </div>
        <Suspense fallback={<ContactForm />}>
          <SignedInForm />
        </Suspense>
      </section>
    </div>
  );
}

/** Signed in: the reply address is already filled in. */
async function SignedInForm() {
  const viewer = await getViewer();
  return <ContactForm email={viewer?.email ?? undefined} />;
}
