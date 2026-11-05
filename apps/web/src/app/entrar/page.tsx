import { BRAND } from "@kits/schema";
import type { Metadata } from "next";

import { KitsMark } from "@/components/layout/pixel-wordmark";
import { SignIn } from "@/features/account/sign-in";
import { devLogin, githubLogin, googleLogin } from "@/server/env";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default function SignInPage() {
  return (
    <div className="grid min-h-[calc(100dvh-14rem)] place-items-center px-4 py-16">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <header className="flex flex-col items-center gap-4 text-center">
          <div className="grid size-14 place-items-center rounded-2xl border bg-muted/40">
            <KitsMark className="size-6" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">Entra en {BRAND.name}</h1>
            <p className="text-sm text-pretty text-muted-foreground">Publica kits, guarda perfiles de marca y mira cuántas personas instalan lo tuyo.</p>
          </div>
        </header>
        <SignIn github={githubLogin} google={googleLogin} dev={devLogin} />
      </div>
    </div>
  );
}
