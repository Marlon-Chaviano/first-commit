import { cliCommand, LOCK_FILE } from "@kits/schema";
import type { Metadata } from "next";

import { Cmd, Code, DocsHeader, Fields, H2, P } from "@/features/docs/docs-ui";

export const metadata: Metadata = {
  title: "Mantener tu proyecto al día",
  description: "kits.lock, update, add y doctor: el proyecto sigue conectado a su kit después de crearlo.",
};

export default function MaintainDocs() {
  return (
    <>
      <DocsHeader title="Mantener tu proyecto al día">
        Un proyecto creado con un kit guarda en <Code>{LOCK_FILE}</Code> de qué kit viene, qué elegiste y qué archivos escribió
        el kit. Súbelo al repositorio: con él, el proyecto recibe las mejoras del kit sin perder tus cambios.
      </DocsHeader>

      <H2 id="update">Actualizar al kit nuevo</H2>
      <Cmd>{cliCommand("update --dry-run")}</Cmd>
      <P>Muestra qué cambiaría; sin <Code>--dry-run</Code> lo aplica tras confirmar. Una actualización:</P>
      <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
        <li>Añade las dependencias, skills, servidores MCP y variables nuevas del kit.</li>
        <li>Reescribe la sección del kit en <Code>AGENTS.md</Code> (el resto del archivo es tuyo y no se toca).</li>
        <li>Actualiza los archivos del kit que no has modificado. Los que editaste o borraste se listan y no se tocan.</li>
        <li>No desinstala nada ni vuelve a ejecutar comandos de configuración: lo que el kit deja de usar se lista para que decidas.</li>
      </ul>
      <P>
        Para ir a una versión concreta: <Code>{cliCommand("update 1.2.0")}</Code>. El CLI avisa una vez al día cuando hay una
        versión nueva del kit de tu proyecto.
      </P>

      <H2 id="add">Añadir piezas del catálogo</H2>
      <Cmd>{cliCommand("add sentry")}</Cmd>
      <P>
        Elige la variante para tu framework (Sentry para Next.js, Expo o Node), instala lo que falta, escribe su configuración,
        su skill y su regla en <Code>AGENTS.md</Code> con sus primeros pasos. Comprueba los requisitos (Kokonut UI necesita
        shadcn/ui) y funciona también en proyectos que no se crearon con un kit. También acepta skills:{" "}
        <Code>{cliCommand("add owner/repo@skill")}</Code>.
      </P>

      <H2 id="doctor">Comprobar el proyecto</H2>
      <Cmd>{cliCommand("doctor")}</Cmd>
      <Fields
        rows={[
          ["componentes", "Otra biblioteca de componentes instalada además de la elegida (error: rompe la regla de AGENTS.md)."],
          ["animaciones", "Bibliotecas de animación que no se eligieron."],
          ["entorno", "Variables de .env.example sin definir o vacías en .env / .env.local."],
          ["skills", "Skills del kit que faltan para alguno de tus agentes, con el comando para instalarlos."],
          ["archivos", "Archivos del kit que se han borrado."],
          ["versión", "Si hay una versión nueva del kit."],
        ]}
      />
      <P>
        Con <Code>--json</Code> da una salida para máquinas y sale con código 1 si hay errores: úsalo en CI o en un hook de
        pre-commit.
      </P>
    </>
  );
}
