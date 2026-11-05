# Fase 2 — Confianza y seguridad

## Objetivo

Que un usuario pueda instalar un kit de un desconocido sabiendo que funciona y qué va a ejecutar. Los kits probados llevan la insignia **Verificado**.

## Por qué

Un kit ejecuta comandos en la máquina del usuario e instala skills que actúan con todos los permisos del agente. Sin pruebas ni transparencia, el catálogo se llena de kits rotos o peligrosos y nadie instala nada de terceros.

## Diseño técnico

### `create-first-commit test [kit]` (`packages/cli/src/test.ts`)

- Nuevo campo `verify` en `kit.json`: `{ "command": "{{pm}} run build", "matrix": [ { "styling": ["nativewind"] }, … ] }`. Si no hay `matrix`, se prueban los valores por defecto y una combinación por cada opción.
- Para cada combinación: `init` en un directorio temporal con `KITS_TELEMETRY=0` y `--no-git`, ejecución de `verify.command`, y un informe JSON (combinación, duración, paso fallido, salida).
- Comprueba también que los skills existen (la lógica de `scripts/build-registry.ts --check-skills` se mueve a `packages/cli`).

### GitHub Action `kits/verify-action`

- Ejecuta `create-first-commit test` en el repo del creador en `ubuntu-latest` y `macos-latest`.
- Envía el informe a `POST /api/v1/verifications` firmado con un **token OIDC de GitHub** (`audience: kits`). La API valida el JWT con las claves públicas de GitHub y comprueba que `repository` coincide con el repo del kit. Así nadie puede falsificar una verificación.
- Tabla `kit_verifications` (kit, versión, commit, resultado, informe, fecha). La insignia se muestra si la última versión publicada tiene una verificación correcta.

### Seguridad visible en la página del kit

- **Qué se va a ejecutar**: la lista de pasos del plan (la misma de `--dry-run`) en la web, generada con `buildPlan` sin ejecutar nada (se mueve a `packages/schema` lo que no dependa de Node).
- **Auditorías de skills**: skills.sh publica auditorías (Gen, Socket, Snyk). Se consultan, se cachean con `"use cache"` y se muestran por skill. Un skill con riesgo alto muestra un aviso.
- **Integridad**: el registro guarda el hash SHA-256 del tarball de cada versión; el CLI lo comprueba tras descargar con `giget` y aborta si no coincide.
- **Denunciar un kit**: botón que crea un registro en `kit_reports` y avisa por email al equipo (Resend).

### CLI más seguro

- En modo interactivo, antes de ejecutar un kit no oficial y no verificado, aviso explícito y confirmación aparte.
- `--allow-commands` necesario en modo `-y` para kits no verificados que tengan `postInstall`.

## Tareas

- [x] Campo `verify` (`command` y `matrix`) en el esquema y en los 5 kits oficiales; el registro valida que cada entrada de la matriz es una combinación posible.
- [x] `create-first-commit test` con combinaciones, log por combinación, informe JSON (`--report`) y salida apta para CI. Opciones `--only-defaults`, `--max`, `--pm`, `--skip-skills`.
- [x] Comprobación de skills movida al CLI (`packages/cli/src/skills-check.ts`), reutilizada por `pnpm registry:check`.
- [x] GitHub Action `actions/verify` (en este repo; se publica en el Marketplace en la fase 8).
- [x] `POST /api/v1/verifications` con validación OIDC (`jose`) y tabla `kit_verifications` (migración `0002`); `GET` para consultar el estado.
- [x] Insignia Verificado en el ranking y estado por plataforma en la página del kit.
- [x] Plan de ejecución visible en la web: `buildPlan` y los adaptadores de agentes viven ahora en `packages/schema`.
- [x] Auditorías de skills (Gen, Socket, Snyk) en el configurador, con aviso para riesgo alto.
- [x] `registry/integrity.json` y comprobación en el CLI al descargar kits oficiales; versiones publicadas inmutables.
- [x] Denuncias de kits (`POST /api/v1/reports`, tabla `kit_reports`, diálogo en la página del kit, email opcional con Resend).
- [x] Avisos en el CLI para kits de la comunidad sin verificar y `--allow-commands` para `-y`.
- [x] Workflow `.github/workflows/kits-test.yml`: prueba en Linux y macOS los kits oficiales que cambian; en `main` publica las verificaciones.

## Estado de los criterios

- 🟡 Los 5 kits oficiales verificados en Linux y macOS: la verificación firmada requiere el repo publicado y la API desplegada (fase 8). En local (macOS) los 5 kits pasan `create-first-commit test` con todas sus combinaciones. La prueba de `mobile-expo` encontró un fallo real (NativeWind con pnpm necesitaba `react-native-css-interop` como dependencia directa), ya corregido.
- ✅ Una verificación sin token OIDC válido se rechaza con 401, y una de otro repositorio con 403 (tests de `verifyGithubToken` y `canVerify`; 401 comprobado contra la API local).
- ✅ Un kit oficial cuyo contenido no coincide con su hash publicado hace que el CLI aborte (tests de `verifyIntegrity`). La comprobación sobre una descarga real necesita el repo publicado.
- ✅ La página de cada kit muestra los comandos exactos que ejecutará `init` con las opciones elegidas.

## Fuera de alcance

Moderación manual a escala (fase 3 añade el panel de administración).
