"use client";

import { ChevronRightIcon, LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { TechIcon } from "@/components/shared/tech-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

type Provider = "github" | "google";

export function SignIn({ github, google, dev, next = "/cuenta" }: { github: boolean; google: boolean; dev: boolean; next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Provider | "dev" | null>(null);

  const social = async (provider: Provider) => {
    setPending(provider);
    setError(null);
    const { error } = await authClient.signIn.social({ provider, callbackURL: next });
    // On success the browser is already on its way to the provider.
    if (error) {
      setPending(null);
      setError(error.message ?? "No se pudo iniciar sesión");
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
    if (result.error) return setError(result.error.message ?? "No se pudo entrar");
    router.push(next);
    router.refresh();
  }

  const providers: { id: Provider; label: string; enabled: boolean; variant: "default" | "outline" }[] = [
    { id: "github", label: "Continuar con GitHub", enabled: github, variant: "default" },
    { id: "google", label: "Continuar con Google", enabled: google, variant: "outline" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {providers.map((p) => (
          <Button
            key={p.id}
            size="lg"
            variant={p.variant}
            disabled={!p.enabled || pending !== null}
            title={p.enabled ? undefined : "Se activa al desplegar (falta configurar la app OAuth)"}
            onClick={() => social(p.id)}
            className="h-11 w-full gap-2.5"
          >
            {pending === p.id ? <LoaderCircleIcon className="animate-spin" /> : <TechIcon id={p.id} label="" className="size-4" />}
            {p.label}
          </Button>
        ))}
        {!github && !google && (
          <p className="text-center text-xs text-muted-foreground">El acceso con GitHub y Google se activa al desplegar la web.</p>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-center text-xs text-pretty text-muted-foreground">
        Para publicar kits, vincula GitHub: tu usuario es tu espacio de nombres (<code className="font-mono">tu-usuario/kit</code>).
      </p>

      {dev && (
        <details className="group rounded-lg border">
          <summary className="flex list-none items-center justify-between px-4 py-3 text-sm text-muted-foreground [&::-webkit-details-marker]:hidden">
            Acceso de desarrollo
            <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
          </summary>
          <form onSubmit={devSignIn} className="flex flex-col gap-4 border-t px-4 py-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dev@local.test" autoComplete="email" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="current-password" required />
              </Field>
            </FieldGroup>
            <Button type="submit" variant="outline" disabled={pending !== null}>
              {pending === "dev" ? "Entrando…" : "Entrar (crea la cuenta si no existe)"}
            </Button>
          </form>
        </details>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Al continuar aceptas los{" "}
        <Link href="/terminos" className="underline underline-offset-4 hover:text-foreground">
          términos
        </Link>{" "}
        y la{" "}
        <Link href="/privacidad" className="underline underline-offset-4 hover:text-foreground">
          política de privacidad
        </Link>
        .
      </p>
    </div>
  );
}
