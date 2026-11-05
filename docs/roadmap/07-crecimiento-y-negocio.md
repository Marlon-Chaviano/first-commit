# Fase 7 — Crecimiento y negocio

## Objetivo

Que kits atraiga usuarios por sí solo y genere ingresos: SEO, equipos con registro privado, kits premium y facturación. Todo se desarrolla y prueba en local (Stripe en modo test); la puesta en producción es la fase 8.

## Diseño técnico

### Crecimiento

- **SEO programático** (skills `programmatic-seo`, `schema`, `seo-audit`, `ai-seo` del repo): páginas indexables por combinación popular, por ejemplo `/stacks/nextjs-supabase-stripe` o `/stacks/expo-nativewind-supabase`. Se generan desde las combinaciones más instaladas (Postgres), con datos reales: instalaciones, qué incluye, comando listo. JSON-LD `SoftwareSourceCode`, sitemap y `llms.txt`.
- **Comparativas**: `/comparar/shadcn-vs-heroui` con datos de uso reales del catálogo.
- **Insignia para README**: `https://first-commit.dev/badge/<kit>.svg` con instalaciones, y un enlace al configurador. Se sugiere al publicar un kit.
- **Changelog público** y newsletter de kits nuevos (Resend + React Email).
- **Programa de creadores**: kits destacados cada semana en la home y la newsletter.

### Equipos (vía de ingresos principal)

- Organizaciones con miembros y roles (`orgs`, `org_members`), vinculadas a una organización de GitHub.
- **Registro privado**: kits y bibliotecas visibles solo para la organización (`kits.visibility = 'org'`). Es el estándar interno de la empresa: su stack, sus reglas de `AGENTS.md` y sus MCP.
- El CLI usa el token de `create-first-commit login` para descargar kits privados; los tarballs privados se sirven desde almacenamiento propio (Vercel Blob o R2) con URLs firmadas, ya no desde GitHub.
- **Políticas**: la organización puede fijar bibliotecas obligatorias o prohibidas, y `create-first-commit doctor` las comprueba en CI.
- Estadísticas de adopción por equipo.

### Kits premium

- Un creador marca un kit como de pago, con precio único o suscripción.
- Stripe Connect (cuentas Express) para pagar a los creadores; comisión de la plataforma configurable.
- La compra da una licencia ligada al usuario; el CLI la comprueba al descargar.
- Reembolsos y disputas gestionados desde el panel de admin.

### Facturación

> **Antes de activar cobros:** la web está en Vercel Hobby para mantener coste cero, y Hobby no admite uso comercial. Cobrar planes o kits premium obliga a pasar a Vercel Pro o a otro proveedor (por ejemplo, Cloudflare Workers con OpenNext). Decídelo al empezar esta parte.


- Planes: Gratis (público), Pro para creadores (estadísticas avanzadas, kits privados personales) y Equipos (por asiento).
- Stripe Billing con Checkout y Customer Portal, webhooks verificados (`STRIPE_WEBHOOK_SECRET`) e idempotencia por `event.id`. Los webhooks son la fuente de verdad del estado de la suscripción.
- Los límites del plan se comprueban en la API (no solo en la UI).

## Decisiones tomadas

- **Por ahora todo es gratis** (decisión del 2026-11-05): el objetivo es conseguir usuarios y kits, y cobrar obligaría a pagar Vercel Pro desde el primer día. Sin `STRIPE_SECRET_KEY`, `effectivePlan` da todas las funciones a todas las cuentas (kits privados, historial de 12 meses, CSV), y se ocultan los planes y `/precios`. El código de pagos queda listo para cuando haya demanda (probablemente kits privados para equipos).
- **Límite anti-spam, no de pago**: 20 kits activos por cuenta (`MAX_KITS_PER_ACCOUNT`; los retirados no cuentan, las versiones nuevas de un kit tampoco, los admins no tienen límite), además de 10 publicaciones por hora.

- **Todo funciona sin cuentas en local**: Stripe se prueba contra `stripe-mock` (servidor oficial de Stripe que valida cada parámetro contra su especificación, en `docker compose`) y los webhooks se firman con `generateTestHeaderString`. Sin `STRIPE_SECRET_KEY`, los pagos y los kits de pago están desactivados y la web lo dice.
- **Activar cobros queda para la fase 8**: Vercel Hobby no admite uso comercial. El código está listo; al lanzarlo hay que elegir Vercel Pro u otro proveedor (por ejemplo, Cloudflare con OpenNext).
- **Los archivos de los kits de la comunidad se sirven desde el registro** (`kit_versions.archive`, comprimido, máx. 5 MB, comprobado con la misma integridad) y no desde GitHub. Es lo que permite kits privados (sin acceso al repo) y de pago (sin que el repo público los regale), sin Vercel Blob ni R2. Los kits de pago exigen una versión con archivo.
- **Las organizaciones comparten espacio de nombres con los usuarios** (`acme/kit`): no se puede crear una org con el nombre de un usuario existente. Se añaden miembros por usuario de GitHub (tienen que haber entrado una vez); no hay invitaciones por email.
- **Kits de pago: pago único** (incluye las versiones futuras), con cargo con destino a la cuenta Connect Express del creador menos `PLATFORM_FEE_PERCENT` (15 % por defecto). La suscripción a un kit queda fuera por ahora.
- **Planes provisionales**: Gratis, Pro (8 €/mes: historial de 12 meses y CSV; sin kits privados personales, que el diseño inicial incluía: un kit privado necesita una organización, aunque sea de una persona) y Equipos (6 € por miembro/mes: registro privado y políticas). Los precios y lo que incluye cada plan son una propuesta: se cambian en `server/plans.ts` y en Stripe.
- **Textos legales**: borradores con marcadores ([titular], [email]) y un aviso visible; necesitan revisión antes del lanzamiento.

## Tareas

- [x] Páginas de stacks (14 curados en `registry/stacks.json` + combinaciones con ≥ 10 instalaciones) y 76 comparativas, sitemap, robots, JSON-LD y `llms.txt`.
- [x] Insignia SVG para README (`/badge/<kit>.svg`), con el Markdown para copiar en la página de cada kit.
- [x] Novedades (`registry/changelog.json`, `/novedades`, RSS) y newsletter semanal con doble opt-in, bajas firmadas y job de QStash.
- [x] Destacados de la comunidad (admin) en la home y en la newsletter.
- [x] Organizaciones, miembros y roles, y registro privado (`create-first-commit publish --org`, descarga con token).
- [x] Políticas de organización comprobadas por `create-first-commit doctor` (también en CI con `KITS_TOKEN`) y al publicar.
- [x] Adopción por equipo: instalaciones, personas y actualizaciones de cada kit privado.
- [x] Kits de pago con Stripe Connect, licencias comprobadas por la API y el CLI, reembolsos desde `/admin` y disputas.
- [x] Planes y Stripe Billing (Checkout, Customer Portal), webhooks firmados e idempotentes, asientos sincronizados, límites comprobados en el servidor.
- [x] Términos, privacidad y política de contenido (borradores).
- [x] Presupuestos de rendimiento en CI (`.github/workflows/web.yml`, Lighthouse CI).

## Perfiles de marca (2026-11-05)

Para quien hace varios proyectos para un mismo cliente o empresa: un perfil guarda colores (y modo oscuro), fuentes, radio, tono, reglas de interfaz y documentación. `create-first-commit <kit> --brand cliente/web` o `create-first-commit brand cliente/web` escriben `docs/brand/` (BRAND.md, tokens.json, los documentos), las variables en la hoja de estilos global (`--brand-*` y las de shadcn/ui) y un bloque en AGENTS.md. Se editan con vista previa en `/cuenta/marcas`, pueden ser de una organización y también funcionan desde un `brand.json` local. Probado de punta a punta: el dueño lo aplica, otro usuario recibe "no encontrado", y aplicarlo dos veces no duplica nada.

## Estado de los criterios

- 🟡 Empresa con kit privado: probado de punta a punta en local con el CLI y la web. Un miembro descarga e instala el kit privado (desde el registro, con su token); alguien de fuera y sin token reciben 404 en la API y en la página, y el kit no aparece en el ranking, la búsqueda, el sitemap ni las insignias. El plan Equipos se activa por webhook (probado). Falta: un pago real en el Checkout de Stripe en modo test (necesita la cuenta, fase 8) y crear la organización desde el navegador (probado con las funciones del servidor; el navegador no estaba disponible).
- 🟡 Kit de pago: probado contra stripe-mock: alta en Connect, precio, Checkout con la comisión y el destino aceptados por la API de Stripe, licencia por webhook y un reembolso la revoca. La respuesta 402 de la API sin licencia y su mensaje en el CLI están escritos pero no se han ejecutado de punta a punta. Falta ver el dinero llegar a una cuenta de creador en modo test (fase 8).
- ✅ Lighthouse (peor de 3 ejecuciones, escritorio): home 100/100/100/100, un kit 98/100/100/100 y un stack 100/100/100/100 (rendimiento, accesibilidad, buenas prácticas, SEO). Las páginas de stacks están en el sitemap; que se indexen se comprueba con el dominio (fase 8).
- 🟡 Todo funciona en local con Stripe en modo test: con stripe-mock sí; con el modo test real de Stripe, en la fase 8.

## Criterios de aceptación

- Una empresa crea una organización, paga el plan de Equipos, publica un kit privado y sus miembros lo instalan; alguien de fuera no puede descargarlo.
- Un creador vende un kit premium, un usuario lo compra y lo instala, y el creador recibe el pago en Stripe.
- Las páginas de stacks se indexan y aparecen en el sitemap; Lighthouse ≥ 90 en rendimiento, accesibilidad y SEO en la home, un kit y un stack.
- Todo lo anterior funciona en local con Stripe en modo test.
