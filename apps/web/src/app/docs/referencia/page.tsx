import { REGISTRY_RAW_BASE } from "@kits/schema";
import type { Metadata } from "next";

import { Code, CodeBlock, DocsHeader, Fields, H2, P } from "@/features/docs/docs-ui";

export const metadata: Metadata = {
  title: "Referencia de kit.json",
  description: "Todos los campos de un kit: base, dependencias, skills, MCP, opciones, bibliotecas, archivos y tareas.",
};

const EXAMPLE = `{
  "$schema": "${REGISTRY_RAW_BASE}/kit.schema.json",
  "name": "mi-saas",
  "version": "1.0.0",
  "title": "Mi stack de SaaS",
  "description": "Next.js + Supabase con mis skills de siempre.",
  "category": "saas",
  "tags": ["nextjs", "supabase"],
  "author": "tu-usuario",
  "base": { "command": "npx create-next-app@latest {{name}} --yes --use-{{pm}}" },
  "libraries": {
    "framework": ["react", "nextjs"],
    "components": "shadcn",
    "animation": ["motion"],
    "observability": ["sentry-nextjs"]
  },
  "dependencies": ["@supabase/supabase-js"],
  "skills": ["supabase/agent-skills@supabase"],
  "mcp": { "supabase": { "url": "https://mcp.supabase.com/mcp" } },
  "env": { "NEXT_PUBLIC_SUPABASE_URL": "" },
  "options": [
    {
      "id": "payments",
      "label": "Pagos",
      "default": "none",
      "choices": [
        { "id": "none", "label": "Sin pagos" },
        {
          "id": "stripe",
          "label": "Stripe",
          "dependencies": ["stripe"],
          "skills": ["stripe/ai@stripe-best-practices"],
          "setupTasks": ["Pon STRIPE_SECRET_KEY en .env"],
          "instructions": "## Pagos\\n\\nVerifica siempre la firma de los webhooks."
        }
      ]
    }
  ],
  "instructions": "## Cómo trabajar aquí\\n\\n- Toda tabla nueva lleva RLS."
}`;

export default function ReferenceDocs() {
  return (
    <>
      <DocsHeader title="Referencia de kit.json">
        El esquema completo está en <Code>{`${REGISTRY_RAW_BASE}/kit.schema.json`}</Code>; enlázalo con <Code>$schema</Code> para
        tener autocompletado y validación en el editor.
      </DocsHeader>

      <H2>Ejemplo</H2>
      <CodeBlock code={EXAMPLE} />

      <H2>Identidad</H2>
      <Fields
        rows={[
          ["name", "Minúsculas y guiones. Es el nombre que se usa en el comando."],
          ["version", "Semver (1.0.0). Súbela en cada cambio y crea la etiqueta de git correspondiente."],
          ["extends", <>Kit del que parte este (<Code>landing-next</Code>, <Code>usuario/repo/kit</Code>, <Code>./ruta</Code>, con <Code>@versión</Code> opcional).</>],
          ["title / description", "Lo que se ve en el catálogo. La descripción dice qué consigue quien lo usa."],
          ["category", "mobile, web, landing, saas, api, extension u other."],
          ["tags / author", "Para buscar y atribuir."],
        ]}
      />

      <H2>Creación del proyecto</H2>
      <Fields
        rows={[
          ["base.command", <>Crea el proyecto y debe crear la carpeta <Code>{"{{name}}"}</Code>. Variables: <Code>{"{{name}}"}</Code>, <Code>{"{{pm}}"}</Code>, <Code>{"{{pmx}}"}</Code>, <Code>{"{{opt.<id>}}"}</Code>.</>],
          ["base.install", "Instala las dependencias si el scaffolder no lo hizo (por ejemplo, con --no-install)."],
          ["addCommand", <>Cómo añadir paquetes, por ejemplo <Code>{"npx expo install {{packages}}"}</Code>.</>],
          ["packageManagers", "Gestores admitidos; el primero es el predeterminado."],
          ["verify.command", <>Lo que <Code>test</Code> ejecuta en cada proyecto generado. Por defecto <Code>{"{{pm}} run build"}</Code>.</>],
          ["verify.matrix", <>Combinaciones a probar, cada una sobre los valores por defecto: <Code>{'[{ "styling": ["nativewind"] }]'}</Code>. Sin ella, se prueban los valores por defecto y una variante por opción.</>],
        ]}
      />

      <H2>Qué se añade</H2>
      <P>Estos campos valen en la raíz del kit y dentro de cada opción (choice), y también los usan las bibliotecas del catálogo.</P>
      <Fields
        rows={[
          ["dependencies / devDependencies", "Paquetes que se añaden después de crear el proyecto."],
          ["skills", <>Referencias <Code>owner/repo@skill</Code> de skills.sh. Se instalan para cada agente elegido.</>],
          ["mcp", <>Servidores MCP: <Code>{"{ command, args, env }"}</Code> o <Code>{"{ url }"}</Code>. Se escriben en el formato de cada agente.</>],
          ["env", <>Variables que se añaden a <Code>.env.example</Code>.</>],
          ["files", "Carpeta del kit que se copia sobre el proyecto."],
          ["writeFiles", <>Archivos pequeños sin descargas: <Code>{"{ path, content, mode }"}</Code>. <Code>mode</Code>: create, append, prepend o insert-before (con <Code>anchor</Code>).</>],
          ["postInstall", "Comandos que se ejecutan al final dentro del proyecto. Si fallan, se avisa y se continúa."],
          ["setupTasks", <>Lo que no se puede automatizar. Se escribe como checklist de primeros pasos en <Code>AGENTS.md</Code>.</>],
          ["instructions", <>Markdown que se añade a <Code>AGENTS.md</Code>; <Code>CLAUDE.md</Code> y <Code>GEMINI.md</Code> lo importan.</>],
        ]}
      />

      <H2>Opciones</H2>
      <Fields
        rows={[
          ["options[].id / label", <>El id es el flag del CLI: <Code>--payments stripe</Code>.</>],
          ["options[].type", "select (una) o multi (varias)."],
          ["options[].default", "Id de la choice por defecto, o lista para multi."],
          ["choices[].requires", <>Solo se puede elegir si otra opción tiene ciertos valores: <Code>{'{ "styling": ["nativewind"] }'}</Code>.</>],
        ]}
      />

      <H2>Bibliotecas</H2>
      <Fields
        rows={[
          ["libraries.framework", <>Fijo (<Code>{'["react", "nextjs"]'}</Code>) o el de una opción (<Code>{'{ "option": "framework" }'}</Code>). Decide qué bibliotecas se ofrecen.</>],
          ["libraries.components", <>Biblioteca de componentes por defecto, o <Code>none</Code>.</>],
          ["libraries.addons / animation / observability", <>Listas por defecto (<Code>[]</Code> para ofrecerlas sin preseleccionar). Omite la clave para no ofrecer esa categoría.</>],
        ]}
      />
    </>
  );
}
