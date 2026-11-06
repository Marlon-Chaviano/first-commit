"use client";

import { ChevronRightIcon, LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { TechIcon } from "@/components/shared/tech-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { BrandName } from "@/components/shared/brand-name";

type Provider = "github" | "google";

export function SignIn({ github, google, dev, next = "/account", initialError }: { github: boolean; google: boolean; dev: boolean; next?: string; initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, setPending] = useState<Provider | "dev" | null>(null);

  const social = async (provider: Provider) => {
    setPending(provider);
    setError(null);
    // Errors come back here (?error=…) instead of Better Auth's own error page.
    const { error } = await authClient.signIn.social({ provider, callbackURL: next, errorCallbackURL: `/login?next=${encodeURIComponent(next)}` });
    // On success the browser is already on its way to the provider.
    if (error) {
      setPending(null);
      setError(error.message ?? "Couldn't log in");
    }
  };

  /** Dev login: signs in, or creates the account the first time. */
  async function devSignIn(event: React.FormEvent) {
    event.preventDefault();
    setPending("dev");
    setError(null);
    const signedIn = await authClient.signIn.email({ email, password });
    const result = signedIn.error ? await authClient.signUp.email({ email, password, name: email.split("@")[0]! }) : signedIn;
    setPending(null);
    if (result.error) return setError(result.error.message ?? "Couldn't log in");
    router.push(next);
    router.refresh();
  }

  const providers: { id: Provider; label: string; enabled: boolean; variant: "default" | "outline" }[] = [
    { id: "github", label: "Continue with GitHub", enabled: github, variant: "default" },
    { id: "google", label: "Continue with Google", enabled: google, variant: "outline" },
  ];
  const lastUsed = useLastProvider();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {providers.map((p) => (
          <Button
            key={p.id}
            size="lg"
            variant={p.variant}
            disabled={!p.enabled || pending !== null}
            title={p.enabled ? undefined : "Turns on once deployed (the OAuth app isn't configured yet)"}
            onClick={() => {
              rememberProvider(p.id);
              void social(p.id);
            }}
            className="relative h-11 w-full gap-2.5"
          >
            {pending === p.id ? <LoaderCircleIcon className="animate-spin" /> : <TechIcon id={p.id} label="" className="size-4" />}
            {p.label}
            {lastUsed === p.id && (
              <span className="absolute right-3 rounded-sm border border-current/25 px-1.5 py-px font-mono text-[10px] leading-4 font-normal opacity-70">Last used</span>
            )}
          </Button>
        ))}
        <p className="text-xs text-pretty text-muted-foreground">
          {github || google ? (
            <>
              Publishing kits needs GitHub: your username becomes your namespace (<code className="font-mono text-foreground">your-user/kit</code>). You can link it
              later.
            </>
          ) : (
            "GitHub and Google login turn on once the site is deployed."
          )}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {dev && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          {/* Flat, not a box inside the card: the divider above already sets it apart. */}
          <details className="group">
            <summary className="flex list-none items-center justify-between py-1 text-sm text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
              Development login (email and password)
              <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
            </summary>
            <form onSubmit={devSignIn} className="flex flex-col gap-4 pt-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dev@local.test" autoComplete="email" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="current-password" required />
                </Field>
              </FieldGroup>
              <Button type="submit" variant="outline" disabled={pending !== null}>
                {pending === "dev" && <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />}
                {pending === "dev" ? "Logging in…" : "Log in or create the account"}
              </Button>
            </form>
          </details>
        </div>
      )}

      <p className="border-t pt-5 text-xs text-pretty text-muted-foreground">
        By continuing you accept the{" "}
        <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
          terms
        </Link>{" "}
        and the{" "}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          privacy policy
        </Link>
        . <BrandName /> is free.
      </p>
    </div>
  );
}

const LAST_PROVIDER = "first-commit:last-login";

/** Remembers the method on this browser, to mark it next time. A convenience: storage may be blocked. */
function rememberProvider(provider: Provider) {
  try {
    localStorage.setItem(LAST_PROVIDER, provider);
  } catch {
    // Private mode or blocked storage: the badge just won't show.
  }
}

function readLastProvider(): Provider | null {
  try {
    const value = localStorage.getItem(LAST_PROVIDER);
    return value === "github" || value === "google" ? value : null;
  } catch {
    return null;
  }
}

/** The method used last time on this browser; null on the server and on the first render. */
function useLastProvider(): Provider | null {
  return useSyncExternalStore(
    () => () => {},
    readLastProvider,
    () => null,
  );
}
