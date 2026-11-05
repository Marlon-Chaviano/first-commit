"use client";

import { useActionState } from "react";

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";

import { subscribeAction, type SubscribeState } from "./actions";

export function SubscribeForm() {
  const [state, action, pending] = useActionState<SubscribeState, FormData>(subscribeAction, { status: "idle" });
  return (
    <form action={action} className="flex max-w-md flex-col gap-2">
      <InputGroup>
        <InputGroupInput type="email" name="email" required placeholder="tu@email.com" aria-label="Email" className="font-mono text-sm" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="submit" variant="default" size="sm" disabled={pending}>
            Suscribirme
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {state.status === "sent" && "Te hemos enviado un email: confirma la suscripción desde el enlace."}
        {state.status === "already" && "Ya estás suscrito."}
        {state.status === "error" && <span className="text-destructive">{state.message}</span>}
        {state.status === "idle" && "Una vez por semana: kits nuevos y destacados. Te puedes dar de baja con un clic."}
      </p>
    </form>
  );
}
