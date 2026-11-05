"use client";

import { ArrowRightIcon, LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";

import { useTypewriter } from "@/hooks/use-typewriter";

import { recommendationHref } from "./href";

const EXAMPLES = ["Landing para lanzar mi app, con animaciones y analítica", "App de recetas para iOS y Android con login", "SaaS de reservas con pagos y emails", "API en Python para un inventario"];

/** Placeholder ideas, typed one after another while the field is empty. */
const PLACEHOLDERS = [
  "Una app de reservas para peluquerías con pagos…",
  "Un blog técnico en Astro con buen SEO…",
  "Una API en Go para procesar pedidos…",
  "Un panel interno en React para ver métricas…",
  "Una extensión de Chrome que resume artículos…",
  "Una app móvil para registrar entrenamientos…",
] as const;

/** "Describe tu proyecto" → recommended kit, opened in the configurator with the options already chosen. */
export function DescribeProject() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  // Animated only while the field is empty and not being used.
  const placeholder = useTypewriter(PLACEHOLDERS, { paused: focused || description.length > 0 });
  const [pending, startTransition] = useTransition();

  const submit = (text: string) => {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/v1/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: text }),
      });
      const body = (await res.json().catch(() => ({}))) as { kit?: string; options?: Record<string, string[]>; reasons?: string[]; error?: string };
      if (!res.ok || !body.kit) {
        setError(body.error ?? "No se pudo recomendar un kit. Prueba otra vez.");
        return;
      }
      router.push(recommendationHref(body.kit, body.options ?? {}, body.reasons ?? []));
    });
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (description.trim()) submit(description);
      }}
    >
      <InputGroup>
        <InputGroupTextarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (description.trim()) submit(description);
            }
          }}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label="Describe tu proyecto"
          maxLength={1000}
          rows={2}
          className="font-mono text-sm"
        />
        <InputGroupAddon align="block-end" className="justify-end">
          <InputGroupButton type="submit" variant="default" size="sm" disabled={pending || !description.trim()}>
            {pending ? <LoaderCircleIcon className="animate-spin" /> : <ArrowRightIcon />}
            Recomendar kit
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="flex flex-wrap items-center gap-2" aria-label="Ejemplos">
        {EXAMPLES.map((example) => (
          <li key={example}>
            <Badge
              variant="outline"
              render={
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setDescription(example);
                    submit(example);
                  }}
                />
              }
              className="h-auto max-w-full px-2.5 py-1 font-mono text-xs font-normal whitespace-normal text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {example}
            </Badge>
          </li>
        ))}
      </ul>
    </form>
  );
}
