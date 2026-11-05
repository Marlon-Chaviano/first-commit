import { BRAND, KITS_SKILL, KITS_SKILL_PUBLISHED, REPO_URL } from "@kits/schema";
import type { Metadata } from "next";

import { Cmd, Code, CodeBlock, DocsHeader, Fields, H2, P } from "@/features/docs/docs-ui";

export const metadata: Metadata = {
  title: "Usar kits desde tu agente",
  description: "Servidor MCP, skill y prompt para que Claude Code, Cursor o Codex creen y mantengan proyectos con kits.",
};

const LOCAL = ["npx", "-y", BRAND.cli, "mcp"];

export default function AgentsDocs() {
  const [skillRepo, skillName] = KITS_SKILL.split("@");
  return (
    <>
      <DocsHeader title="Usar kits desde tu agente">
        Tu agente puede elegir el kit, enseñarte el plan y crear el proyecto por ti. Pídeselo con tus palabras: «crea una landing
        con animaciones y analítica».
      </DocsHeader>

      <H2 id="mcp">Servidor MCP local</H2>
      <P>
        Corre en tu máquina con <Code>{LOCAL.join(" ")}</Code> y es el único que crea proyectos. Antes de ejecutar nada, el agente
        te enseña el plan (<Code>plan_init</Code>) y necesita tu aprobación.
      </P>
      <P>Claude Code:</P>
      <Cmd>{`claude mcp add ${BRAND.name} -- ${LOCAL.join(" ")}`}</Cmd>
      <P>
        Cursor (<Code>.cursor/mcp.json</Code>):
      </P>
      <CodeBlock code={JSON.stringify({ mcpServers: { [BRAND.name]: { command: LOCAL[0], args: LOCAL.slice(1) } } }, null, 2)} />
      <P>
        Codex (<Code>~/.codex/config.toml</Code>):
      </P>
      <CodeBlock code={`[mcp_servers.${BRAND.name}]\ncommand = "${LOCAL[0]}"\nargs = [${LOCAL.slice(1).map((a) => `"${a}"`).join(", ")}]`} />
      <P>
        Crear un proyecto tarda unos minutos. Si tu agente corta las herramientas largas, súbele el tiempo máximo (en Claude
        Code, la variable <Code>MCP_TOOL_TIMEOUT</Code> en milisegundos).
      </P>

      <H2 id="tools">Herramientas</H2>
      <Fields
        rows={[
          ["search_kits", "Busca kits por texto, categoría o biblioteca (stripe, sentry, motion…)."],
          ["get_kit", "Opciones de un kit con sus valores y requisitos, skills y comando por defecto."],
          ["recommend_kit", "Kit y opciones para la descripción de tu proyecto, con los motivos. Siempre una combinación válida."],
          ["plan_init", "Todo lo que haría init (comandos, archivos, skills), sin ejecutar nada."],
          ["init_kit", "Crea el proyecto. Solo en el servidor local y con aprobación explícita."],
          ["add_library", "Añade una biblioteca del catálogo o un skill al proyecto. Solo en el servidor local."],
        ]}
      />

      <H2 id="remote">Servidor MCP remoto</H2>
      <P>
        Sin instalar nada: <Code>{`${BRAND.siteUrl}/mcp`}</Code> (HTTP, sin sesión). Busca, recomienda y planea; no ejecuta
        comandos, así que devuelve el comando para que lo ejecute tu agente en tu terminal.
      </P>
      <Cmd>{`claude mcp add --transport http ${BRAND.name} ${BRAND.siteUrl}/mcp`}</Cmd>

      <H2 id="skill">Skill</H2>
      <P>
        El skill <Code>{skillName}</Code> enseña al agente cuándo usar kits, cómo elegir opciones y cómo mantener el proyecto con{" "}
        <Code>update</Code>, <Code>add</Code> y <Code>doctor</Code>.
        {KITS_SKILL_PUBLISHED
          ? " Todos los kits oficiales lo instalan."
          : " Todavía no está publicado en skills.sh; mientras tanto, instálalo desde una copia del repositorio."}
      </P>
      <Cmd>{`npx skills@latest add ${skillRepo} --skill ${skillName}`}</Cmd>
      <P>
        Código del skill: <a className="underline underline-offset-4" href={`${REPO_URL}/tree/${BRAND.branch}/skills/${skillName}`}>skills/{skillName}</a>.
      </P>

      <H2 id="prompt">Sin MCP: el prompt</H2>
      <P>
        En la página de cada kit, la pestaña <Code>Prompt</Code> junto al comando da un texto para pegar en tu agente con las
        opciones que elegiste: el agente ejecuta el comando con <Code>--dry-run</Code>, te enseña el plan y lo aplica cuando
        confirmas.
      </P>
    </>
  );
}
