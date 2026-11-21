# Contribuir

Hay tres formas de ayudar: añadir una biblioteca al catálogo, mejorar un kit oficial o publicar tu propio kit (no necesita PR: ver `/docs` en la web).

## Preparar el entorno

```bash
pnpm install
pnpm build                 # schema y CLI
pnpm test
```

Para probar contra tu copia del registro en vez de la de GitHub, exporta `KITS_REGISTRY` con la ruta a `registry/`:

```bash
export KITS_REGISTRY="$PWD/registry"
node packages/cli/dist/index.js test saas-next-supabase --skip-skills
```

## Añadir una biblioteca al catálogo

El catálogo (`registry/libraries.json`) es compartido: una biblioteca aparece en todos los kits que declaran su categoría en `libraries` y tienen uno de sus `frameworks`. No edites los kits para añadir una biblioteca.

1. **Comprueba el paquete** en su registro (npm, PyPI, pkg.go.dev). Usa la versión estable actual, nunca una beta o RC.
2. **Busca el skill oficial** en skills.sh, publicado por la organización de la biblioteca. Si no existe, no pongas uno de terceros.
3. **Escribe la entrada.** Campos principales:

   | Campo | Para qué |
   | --- | --- |
   | `kind` | Categoría de `packages/schema/src/categories.ts`, incluidos los packs `design`, `security` y `workflow`. |
   | `frameworks` | Dónde funciona. Si la configuración cambia por plataforma (Sentry en Next.js y en Node), crea una entrada por variante. |
   | `excludeFrameworks` | Plataformas incompatibles aunque coincida el renderer: una app Electron con React no debe recibir hosting de sitios estáticos. |
   | `requiredPlatform` | Capacidad que también debe declarar el kit en `libraries.platforms`. Por ejemplo, `http-api` habilita contratos OpenAPI y `nestjs` habilita la integración de Swagger para sus controladores. |
   | `usage` | Regla para el agente en `AGENTS.md`: cómo se usa y qué no hacer. |
   | `dependencies`, `devDependencies` | Paquetes. |
   | `writeFiles` | Archivos de configuración. `mode`: `create`, `append`, `prepend`, `insert-before` (con `anchor`) o `json-merge` (scripts de `package.json`). Admite `{{name}}`, `{{pm}}` y `{{pmx}}`. |
   | `env` | Variables para `.env.example`. |
   | `setupTasks` | Lo que el agente o el usuario deben hacer a mano (crear una cuenta, envolver un provider). |
   | `requires` | Otras opciones necesarias, por ejemplo `{"database": ["drizzle-postgres"]}`. |
   | `mcp`, `skills`, `postInstall` | Servidores MCP, skills y comandos tras instalar. |

4. **Que compile sin claves.** El proyecto recién creado no tiene `.env`: un cliente que lanza un error al importarse sin su API key rompe el build. Créalo al usarlo (mira `resend` o `stripe` en el catálogo).
5. **Pruébala.** Añádela a `verify.matrix` de un kit que la ofrezca y ejecuta `create-first-commit test <kit>`. Una biblioteca entra en el catálogo solo si pasa en al menos un kit.
6. `pnpm registry:check` valida el esquema y que cada skill exista.

Los packs de skills siguen este mismo catálogo, sin añadir paquetes de ejecución ni claves. Los de seguridad se documentan en [docs/security-packs.md](docs/security-packs.md): comprueba la procedencia y los archivos auxiliares, además de que exista el nombre de la skill. Activa el pack en los valores por defecto de un kit para verificarlo con `create-first-commit test`.

Los kits pueden declarar `libraries.platforms` además de `framework`: el destino de publicación de una extensión debe seguir siendo el mismo al cambiar su renderer. `pnpm registry:coverage` genera [la cobertura de los 70 kits](docs/catalog-coverage.md). No fuerces categorías incompatibles para aumentar el número de opciones y no instales dependencias del frontend en la raíz de un monorepo con servicios separados. Las opciones basadas en capacidades incluidas en el SDK deben indicarlo; las que requieren configuración manual deben declararla en `setupTasks`.

## Cambiar un kit oficial

- Sube `version` en su `kit.json` con cada cambio: las versiones publicadas son inmutables (`registry/integrity.json`).
- Añade a `verify.matrix` las combinaciones nuevas y pásalas con `create-first-commit test`.
- Ejecuta `pnpm registry:index` para regenerar el índice y la integridad.

## Código

Lee `AGENTS.md`: estructura, reglas de UI (shadcn, blanco y negro), caché y tests. La lógica de `packages/schema` y `packages/cli` lleva tests junto al código.
