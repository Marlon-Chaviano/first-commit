import { BRAND, cliCommand } from "@kits/schema";
import { BarChart3Icon, KeyRoundIcon, PaletteIcon, UploadIcon, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { BrandMark, PixelWordmark } from "@/components/layout/pixel-wordmark";
import { Command } from "@/components/shared/command";
import { SignIn } from "@/features/account/sign-in";
import { oauthErrorMessage } from "@/lib/oauth-errors";
import { devLogin, githubLogin, googleLogin } from "@/server/env";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

/** What an account adds. Browsing, the configurator and the CLI work without one, and the page says so. */
const UNLOCKS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: UploadIcon, title: "Publish kits", text: "Under your GitHub username: your-user/kit." },
  { icon: PaletteIcon, title: "Brand profiles", text: "Colors, fonts and logo, private to you or your team." },
  { icon: BarChart3Icon, title: "Install statistics", text: "How many people install your kits, and with which options." },
  { icon: KeyRoundIcon, title: "Tokens for the CLI and CI", text: "Publish from your terminal or GitHub Actions." },
];

export default function SignInPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto grid min-h-[calc(100dvh-14rem)] w-full max-w-5xl items-center gap-12 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-20">
      <section className="order-2 flex flex-col gap-8 lg:order-1">
        <div className="flex flex-col gap-3">
          {/* The name is the protagonist: the site's pixel wordmark, built pixel by pixel and waiting at a cursor. */}
          <h1 className="flex flex-col gap-5">
            <span className="text-lg font-medium text-muted-foreground">Log in to</span>
            <PixelWordmark text={BRAND.name} layout="inline" animated cursor className="w-full max-w-md" />
          </h1>
          <p className="mt-3 max-w-md text-lg text-pretty text-muted-foreground">
            Browsing, the configurator and the CLI work without an account. Logging in adds what&apos;s yours:
          </p>
        </div>
        <ul className="flex max-w-md flex-col divide-y border-y">
          {UNLOCKS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-4 py-4">
              <Icon className="mt-0.5 size-5 shrink-0" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{title}</span>
                <span className="text-sm text-pretty text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex max-w-md flex-col gap-2">
          <p className="text-sm text-muted-foreground">Or from your terminal, with the same account:</p>
          <Command command={cliCommand("login")} className="w-fit max-w-full" />
        </div>
      </section>

      <section aria-labelledby="sign-in-title" className="order-1 flex w-full max-w-sm flex-col gap-6 justify-self-center rounded-xl border bg-card p-6 sm:p-8 lg:order-2 lg:max-w-none">
        <div className="flex flex-col gap-4">
          <BrandMark className="-ml-1 size-9" />
          <div className="flex flex-col gap-1">
            <h2 id="sign-in-title" className="text-xl font-semibold tracking-tight">
              Continue with your account
            </h2>
            <p className="text-sm text-pretty text-muted-foreground">New here? The same button creates it.</p>
          </div>
        </div>
        <Suspense fallback={<SignIn github={githubLogin} google={googleLogin} dev={devLogin} />}>
          <WithNext params={searchParams.then((p) => ({ next: p.next, error: p.error }))} />
        </Suspense>
      </section>
    </div>
  );
}

/** Back to where the person came from (?next=/account/brands). Only same-site paths, never another origin. */
async function WithNext({ params }: { params: Promise<{ next?: string | string[]; error?: string | string[] }> }) {
  const { next: value, error } = await params;
  const path = typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/account";
  return <SignIn github={githubLogin} google={googleLogin} dev={devLogin} next={path} initialError={typeof error === "string" ? oauthErrorMessage(error) : undefined} />;
}
