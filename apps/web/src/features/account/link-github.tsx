"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { TechIcon } from "@/components/shared/tech-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/** For accounts without GitHub (Google or dev login): publishing needs it to check repo permissions. */
export function LinkGithub({ enabled, back = "/cuenta" }: { enabled: boolean; back?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Alert>
      <TechIcon id="github" label="" />
      <AlertTitle>Vincula GitHub para publicar kits</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>Tu usuario de GitHub será tu espacio de nombres (tu-usuario/kit) y así comprobamos que puedes publicar desde cada repositorio.</p>
        <Button
          size="sm"
          className="w-fit gap-2"
          disabled={!enabled || pending}
          title={enabled ? undefined : "Se activa al desplegar (falta configurar la app OAuth de GitHub)"}
          onClick={async () => {
            setPending(true);
            const { error } = await authClient.linkSocial({ provider: "github", callbackURL: back });
            if (error) {
              setPending(false);
              toast.error(error.message ?? "No se pudo vincular GitHub");
            }
          }}
        >
          {pending ? <LoaderCircleIcon className="animate-spin" /> : <TechIcon id="github" label="" className="size-3.5" />}
          Vincular GitHub
        </Button>
      </AlertDescription>
    </Alert>
  );
}
