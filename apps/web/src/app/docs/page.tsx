import { BRAND, cliCommand } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";

import { Cmd, Code, CodeBlock, DocsHeader, H2, P } from "@/features/docs/docs-ui";

export const metadata: Metadata = {
  title: "Crear un kit",
  description: "Convierte tu proyecto en un kit con un comando, haz variantes con extends y compártelo.",
};

const VERIFY_WORKFLOW = `# .github/workflows/kit.yml
name: Verify kit
on: { push: { branches: [main] } }
permissions: { contents: read, id-token: write }
jobs:
  verify:
    strategy: { matrix: { os: [ubuntu-latest, macos-latest] } }
    runs-on: \${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: ${BRAND.repo}/actions/verify@main
        with: { kit: ./kit }`;

const EXTENDS_EXAMPLE = `{
  "name": "landing-dark",
  "version": "0.1.0",
  "extends": "landing-next",
  "title": "Landing oscura",
  "libraries": { "addons": ["magicui"] },
  "instructions": "## Estilo\\n\\nTodo en modo oscuro."
}`;

export default function CreateKitDocs() {
  return (
    <>
      <DocsHeader title="Crear un kit">
        Un kit es una carpeta con un <Code>kit.json</Code> y, si quieres, archivos que se copian al proyecto. Lo más rápido
        es generarlo desde un proyecto que ya te gusta.
      </DocsHeader>

      <H2 id="desde-tu-proyecto">1. Desde tu proyecto</H2>
      <P>Dentro de un proyecto Next.js, Expo, Hono, WXT o Vite:</P>
      <Cmd>{cliCommand("create")}</Cmd>
      <P>Detecta y te deja revisar antes de escribir nada:</P>
      <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
        <li>El framework, y con él el comando oficial que crea el proyecto base.</li>
        <li>
          Las bibliotecas del <Link href="/docs/bibliotecas" className="text-foreground underline underline-offset-4">catálogo</Link>{" "}
          que usas (shadcn, Kokonut UI, Motion, Sentry…), que pasan a ser opciones con su regla en <Code>AGENTS.md</Code>.
        </li>
        <li>Tus dependencias propias, sin las que ya trae la plantilla base.</li>
        <li>
          Tus skills (de <Code>skills-lock.json</Code>), servidores MCP (<Code>.mcp.json</Code>) y variables (
          <Code>.env.example</Code>; nunca lee <Code>.env</Code>).
        </li>
        <li>Tus instrucciones de <Code>AGENTS.md</Code>, sin lo que generan kits o el scaffolder.</li>
        <li>Los archivos propios que elijas copiar (configuración, utilidades). Por defecto, ninguno.</li>
      </ul>
      <P>
        El kit queda en <Code>./kit</Code>. Sin preguntas: <Code>{cliCommand("create -y --name mi-kit --include src/lib")}</Code>.
        Si el framework no se reconoce, indica el comando base con <Code>--base &quot;…&quot;</Code>.
      </P>

      <H2 id="a-mano">2. A mano</H2>
      <Cmd>{cliCommand("create --blank mi-kit")}</Cmd>
      <P>
        Crea un <Code>kit.json</Code> mínimo con el esquema enlazado, para tener autocompletado en el editor. Todos los
        campos están en la <Link href="/docs/referencia" className="text-foreground underline underline-offset-4">referencia</Link>.
      </P>

      <H2 id="extends">3. Variantes con extends</H2>
      <P>
        Un kit puede partir de otro y declarar solo lo que cambia. Las listas (dependencias, skills, tareas) se suman, los
        objetos (<Code>env</Code>, <Code>mcp</Code>, <Code>libraries</Code>) se combinan, las instrucciones se añaden al final
        y una opción con el mismo <Code>id</Code> sustituye a la del padre.
      </P>
      <CodeBlock code={EXTENDS_EXAMPLE} />
      <P>
        El padre puede ser un kit oficial, un repo (<Code>usuario/repo/kit</Code>) o una ruta local, con versión opcional (
        <Code>landing-next@1.0.0</Code>). Se admiten hasta 3 niveles.
      </P>

      <H2 id="probar">4. Pruébalo</H2>
      <Cmd>{cliCommand("./kit mi-proyecto --dry-run")}</Cmd>
      <P>
        Muestra cada comando y archivo sin ejecutar nada. Quita <Code>--dry-run</Code> para crear el proyecto de verdad y
        compílalo antes de compartirlo.
      </P>

      <H2 id="compartir">5. Publícalo y versiónalo</H2>
      <P>
        Sube el kit a un repo público de GitHub, haz push y publícalo desde la terminal (con un token de{" "}
        <Link href="/cuenta" className="text-foreground underline underline-offset-4">tu cuenta</Link>) o desde{" "}
        <Link href="/publicar" className="text-foreground underline underline-offset-4">la web</Link>:
      </P>
      <Cmd>{cliCommand("login")}</Cmd>
      <Cmd>{cliCommand("publish ./kit")}</Cmd>
      <P>
        Queda en el catálogo como <Code>tu-usuario/nombre-del-kit</Code>, fijado al commit publicado y con su hash de
        integridad. Sin publicar, también se puede instalar directamente desde GitHub:
      </P>
      <Cmd>{cliCommand("tu-usuario/tu-repo/kit")}</Cmd>
      <P>
        Cada cambio sube <Code>version</Code> (semver) en el <Code>kit.json</Code> y crea una etiqueta de git con ese número.
        Así se puede instalar una versión concreta: <Code>{cliCommand("tu-usuario/tu-repo/kit@v1.2.0")}</Code>. Para
        aparecer en el catálogo oficial, abre un PR que añada tu kit a <Code>registry/kits/</Code>.
      </P>

      <H2 id="verificar">6. Verifícalo</H2>
      <P>
        <Code>{cliCommand("test ./kit")}</Code> instala el kit con varias combinaciones de opciones en carpetas temporales,
        ejecuta su comprobación (<Code>verify.command</Code>, por defecto <Code>build</Code>) y escribe un informe. Para la
        insignia <strong className="text-foreground">Verificado</strong>, ejecútalo en GitHub Actions: el informe se firma con
        el token OIDC del repositorio, así que nadie puede falsificarlo.
      </P>
      <CodeBlock code={VERIFY_WORKFLOW} />
      <P>
        Para elegir qué combinaciones probar, define <Code>verify.matrix</Code> en el <Code>kit.json</Code> (ver la{" "}
        <Link href="/docs/referencia" className="text-foreground underline underline-offset-4">referencia</Link>). Los kits de
        la comunidad sin verificar muestran un aviso antes de ejecutarse y, con <Code>-y</Code>, exigen{" "}
        <Code>--allow-commands</Code>.
      </P>

      <H2 id="buenas-practicas">Buenas prácticas</H2>
      <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
        <li>Escribe instrucciones como reglas concretas (&quot;añade dependencias con npx expo install&quot;), no como descripciones.</li>
        <li>Usa bibliotecas del catálogo en vez de dependencias sueltas: traen su skill, su configuración y su regla.</li>
        <li>Lo que no se puede automatizar (crear una cuenta, pegar una clave) va en <Code>setupTasks</Code>, no en las instrucciones.</li>
        <li>Prefiere skills oficiales de la organización de cada herramienta.</li>
        <li>No copies tu aplicación entera: un kit es un punto de partida, no un clon.</li>
      </ul>

      <H2 id="seguridad">Seguridad</H2>
      <P>
        Un kit ejecuta comandos en la máquina de quien lo instala. El CLI siempre muestra el plan completo y, salvo con{" "}
        <Code>-y</Code>, pide confirmación. Revisa los kits de terceros igual que revisarías un script.
      </P>
    </>
  );
}
