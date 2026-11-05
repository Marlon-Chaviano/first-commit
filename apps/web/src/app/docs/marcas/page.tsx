import { cliCommand } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";

import { Cmd, Code, CodeBlock, DocsHeader, Fields, H2, P } from "@/features/docs/docs-ui";

export const metadata: Metadata = {
  title: "Perfiles de marca",
  description: "Los colores, fuentes, reglas de interfaz y documentación de una empresa, aplicados a cualquier kit con --brand.",
};

const EXAMPLE = `{
  "name": "web",
  "title": "Acme",
  "colors": { "primary": "#e11d48", "primaryForeground": "#ffffff", "background": "#ffffff", "foreground": "#0a0a0a" },
  "fonts": { "sans": "Inter" },
  "radius": "0.75rem",
  "voice": "Cercano y directo, de tú.",
  "rules": ["Botones principales siempre en el color principal", "Iconos de Lucide, nunca emojis"],
  "docs": { "guia.md": "# Guía de estilo\\n\\n…" }
}`;

export default function BrandsDocs() {
  return (
    <>
      <DocsHeader title="Perfiles de marca">
        Si haces varios proyectos para un mismo cliente o para tu empresa, guarda una vez su identidad (colores, fuentes, reglas de
        interfaz, tono y documentación) y aplícala a cualquier kit. El agente la sigue desde el primer commit, sin que se lo expliques cada vez.
      </DocsHeader>

      <H2 id="crear">Crear un perfil</H2>
      <P>
        En <Link className="underline underline-offset-4" href="/cuenta/marcas">tu cuenta → Perfiles de marca</Link>, con vista previa.
        Puede ser tuyo o de una organización (lo usan todos sus miembros). También vale un archivo local:
      </P>
      <CodeBlock code={EXAMPLE} />
      <P>
        ¿Solo tienes la web del cliente? Pídele a tu agente que extraiga los colores y las fuentes con el skill{" "}
        <Code>extract-design-system</Code> y que escriba el <Code>brand.json</Code>.
      </P>

      <H2 id="usar">Usarlo</H2>
      <Cmd>{cliCommand("landing-next --brand acme/web")}</Cmd>
      <P>En un proyecto que ya existe (también para actualizarlo cuando cambie el perfil):</P>
      <Cmd>{cliCommand("brand acme/web")}</Cmd>
      <Cmd>{cliCommand("brand ./brand.json")}</Cmd>

      <H2 id="que-escribe">Qué escribe</H2>
      <Fields
        rows={[
          ["docs/brand/BRAND.md", "Colores, tipografía, forma, tono y reglas, para personas y agentes."],
          ["docs/brand/tokens.json", "Los mismos valores como design tokens, para proyectos que no son web (móvil, emails…)."],
          ["docs/brand/*.md", "La documentación de la empresa que añadiste al perfil."],
          ["Hoja de estilos global", "Variables --brand-* y las de shadcn/ui (--primary, --background…) al final del archivo, en un bloque que se reescribe al actualizar."],
          ["AGENTS.md", "Un bloque con las reglas: usar solo los tokens de la marca, sus fuentes y su tono."],
        ]}
      />
      <P>
        Lo que escribas fuera de esos bloques no se toca. El proyecto recuerda el perfil en <Code>kits.lock</Code>: basta con{" "}
        <Code>{cliCommand("brand")}</Code> para traer la versión nueva.
      </P>
    </>
  );
}
