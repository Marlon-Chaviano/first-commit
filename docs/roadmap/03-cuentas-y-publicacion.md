# Fase 3 — Cuentas, publicación y perfiles de creador

## Objetivo

Un creador inicia sesión con GitHub, publica su kit pegando la URL del repo y ve en su perfil cuántas personas lo instalan y qué opciones eligen.

## Por qué

Publicar con un PR al registro oficial no escala y no motiva. La métrica pública es la recompensa del creador, como las descargas en npm.

## Diseño técnico

### Autenticación

- **Decisión: Better Auth o Auth.js.** Recomendado Better Auth (Drizzle adapter, sesiones en Postgres), con proveedor GitHub.
- Tablas: `users`, `sessions`, `accounts` (generadas por la librería) y `profiles` (`handle` = usuario de GitHub, bio, enlaces).
- El CLI gana `create-first-commit login` (device flow de GitHub → token de kits guardado en `~/.config/kits/credentials`, permisos 600) para publicar desde la terminal.

### Registro respaldado por base de datos

Hoy el registro es la carpeta `registry/` del repo. Pasa a ser:

| Tabla | Contenido |
| --- | --- |
| `kits` | `id`, `owner_id`, `slug` (`handle/nombre`; los oficiales sin handle), `repo_url`, `path`, `official`, `status` (activo, oculto, retirado) |
| `kit_versions` | `kit_id`, `version`, `commit_sha`, `manifest` (jsonb del `kit.json` expandido), `tarball_sha256`, `published_at` |
| `libraries` | El catálogo, editable por admins (antes `registry/libraries.json`) |

- `GET /api/v1/kits`, `GET /api/v1/kits/:slug`, `GET /api/v1/kits/:slug/versions/:version` y `GET /api/v1/libraries`, cacheadas con `"use cache"` + `cacheTag(slug)` y revalidadas al publicar.
- El CLI deja de leer `index.json` y `libraries.json` en crudo de GitHub y usa esta API (con fallback al repo si la API no responde).
- Los kits oficiales se sincronizan desde `registry/` con un job en cada deploy.

### Publicar

- Web: `/publicar` → URL del repo y ruta → la API descarga el `kit.json` en el commit indicado, lo valida con `parseKit` + `expandKit`, calcula el hash y crea la versión. El usuario debe tener acceso de escritura al repo (se comprueba con su token de GitHub).
- CLI: `create-first-commit publish` desde la carpeta del kit hace lo mismo con el commit actual.
- Cada versión publicada lanza la verificación (fase 2) si el repo tiene la Action.

### Perfiles y estadísticas

- `/u/[handle]`: kits del creador, instalaciones totales y por kit, tendencia, insignias.
- `/kits/[handle]/[kit]/stats` (solo para el dueño): instalaciones por día (de `kit_stats_daily`), usuarios únicos, desglose de opciones y agentes (de `kits:breakdown:*` en Redis), países, versiones de CLI.
- Ranking con filtros: oficiales, verificados, comunidad, por categoría y por framework.

### Administración

- Rol `admin` en `profiles`. Panel `/admin`: denuncias, ocultar o retirar kits, editar el catálogo de bibliotecas, marcar kits como oficiales.

## Decisiones tomadas

- **Better Auth 1.7** con el adaptador de Drizzle. `handle` (login de GitHub) y `role` son campos solo de servidor (`input: false`): el usuario no puede cambiarlos. El handle real se obtiene de la API de GitHub al vincular la cuenta.
- **`create-first-commit login` con un token** creado en `/cuenta` (o `KITS_TOKEN` en CI), en lugar del device flow de GitHub: más simple, sirve igual para CI y los tokens se pueden revocar. Solo se guarda su hash SHA-256.
- **Los kits oficiales siguen en `registry/`** (revisados por PR, con integridad por versión). Postgres guarda solo los kits de la comunidad; no hace falta sincronizar los oficiales.
- **El catálogo de bibliotecas sigue en `registry/libraries.json`**, editado por PR (no desde el panel de admin): cada biblioteca se prueba con `create-first-commit test` antes de entrar.
- **Las versiones guardan el `kit.json` tal como lo escribió su autor**: la herencia se resuelve al leer, contra los padres reales (oficiales o publicados).
- **Login de desarrollo** (email y contraseña) solo con `DEV_LOGIN=1` y nunca en producción, para probar todo sin la app OAuth de GitHub (que se crea en la fase 8). Igual que publicar desde una carpeta local (`create-first-commit publish --local`).

## Tareas

- [x] Better Auth con GitHub, `handle`/`role` de solo servidor y tablas `user`, `session`, `account`, `verification` (migración `0003`).
- [x] Tablas `kits` y `kit_versions` (versiones inmutables con commit e integridad) y `api_tokens`.
- [x] `publishKit()`: permiso de escritura en el repo (API de GitHub con el token del usuario), commit fijado, descarga con giget, validación completa, propiedad del nombre y versión nueva.
- [x] API v1: `GET/POST /api/v1/kits`, `GET /api/v1/kits/<slug>`, `GET /api/v1/me`. Rate limit de publicación por usuario (10/h).
- [x] El CLI resuelve `usuario/kit` a través del registro (descarga en el commit publicado y comprueba la integridad) y vuelve a GitHub directo si no está publicado.
- [x] `/entrar`, menú de usuario, `/cuenta` (mis kits y tokens), `/publicar`, `create-first-commit login`/`logout`/`whoami`/`publish`.
- [x] Perfil público `/u/<handle>` y panel de estadísticas del dueño `/cuenta/kits/<slug>` (opciones, agentes, gestor, versiones, países, últimos 30 días).
- [x] Filtros del ranking: oficiales, comunidad, verificados y categoría. Los kits publicados entran en el ranking.
- [x] Panel de administración `/admin`: denuncias (resolver, descartar, reabrir) y ocultar o mostrar kits.
- [x] Página del kit de la comunidad (`/kits/usuario/kit`) con autor, origen y tipo.

## Estado de los criterios

- 🟡 Publicar y luego instalar con `npx create-first-commit usuario/kit`: publicar funciona de punta a punta en local (web y CLI, con el login de desarrollo y `--local`). La instalación desde el registro descarga de GitHub, así que se comprueba en la fase 8 con un repo real.
- 🟡 Publicar desde un repo sin permiso de escritura se rechaza: el código consulta `permissions.push` en la API de GitHub, pero eso solo se puede probar con la app OAuth (fase 8). Comprobado en local: sin cuenta de GitHub vinculada se rechaza, y sin token o con un token falso responde 401.
- ✅ El dueño ve sus estadísticas desglosadas; otro usuario recibe "no encontrado" (comprobado con dos cuentas).
- 🟡 Un admin oculta un kit: comprobado que la API devuelve 404 y el CLI deja de encontrarlo en el registro. Que desaparezca del ranking depende de la invalidación de caché de la acción del panel, que no se ha probado desde el navegador. Nota: ocultar lo quita del registro, no de GitHub; si existe un repo con ese nombre, sigue instalándose como ruta de GitHub sin verificar (con aviso).
- ✅ Republicar una versión existente se rechaza con 409 y pide subir `version`.

## Fuera de alcance

Kits privados y de pago (fase 7).
