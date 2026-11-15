# Cobertura del catálogo

Generado con `pnpm registry:coverage`. 70 kits y 256 entradas de catálogo.

La evidencia de esta ampliación está en [catalog-validation.json](catalog-validation.json): una combinación verificada por cada opción nueva. [catalog-package-sources.json](catalog-package-sources.json) registra las consultas a los registros oficiales de paquetes.

Los números cuentan opciones disponibles, sin «None»; no significan que todas estén instaladas ni verificadas en cada combinación. «—» indica que esa categoría no se ofrece en el configurador: puede venir incluida en el kit base o no ser pertinente. El pack general de Security y el de flujo de trabajo están disponibles en los 70 kits y no cuentan como bibliotecas de estas columnas.

Los frameworks y plataformas se resuelven con `loadRegistryKits`, igual que en CLI y web. Las extensiones reciben destinos de publicación propios; los proyectos de escritorio no reciben hosting web. Los monorepos conservan las dependencias dentro de cada servicio: sus opciones comunes cubren CI, comprobaciones y despliegue por servicio, sin instalar bibliotecas del frontend en la raíz.

| Kit | Lenguaje | UI | Auth | Datos | Observabilidad | Tests | Calidad | CI | Despliegue | Otras opciones |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| ai-agent-python | python | — | 1 | 2 | 1 | 1 | 2 | 1 | 1 | Payments: 1; Transactional email: 1; AI: 2 |
| android-compose | kotlin | — | 1 | 1 | — | 1 | 1 | 1 | 1 | Global state: 1; Server data: 1; Forms and validation: 1; Languages (i18n): 1 |
| api-aspnet | csharp | — | 1 | 2 | 1 | 1 | 1 | 1 | 2 | Forms and validation: 1; Payments: 1; Transactional email: 1; Languages (i18n): 1; AI: 1 |
| api-axum | rust | — | 1 | 1 | 1 | 1 | 1 | 1 | 2 | Transactional email: 1 |
| api-django | python | — | 1 | 2 | 1 | 2 | 2 | 1 | 1 | Payments: 1; Transactional email: 1; AI: 2 |
| api-elysia | typescript | — | 1 | 1 | 2 | 1 | 3 | 1 | 1 | Forms and validation: 2; Payments: 1; Transactional email: 1; AI: 2 |
| api-express | typescript | — | 1 | 1 | 2 | 1 | 3 | 1 | 4 | Forms and validation: 2; Payments: 1; Transactional email: 1; AI: 2 |
| api-fastapi | python | — | 1 | 2 | 1 | 1 | 2 | 1 | 1 | Payments: 1; Transactional email: 1; AI: 2 |
| api-fastify | typescript | — | 1 | 1 | 2 | 1 | 3 | 1 | 4 | Forms and validation: 2; Payments: 1; Transactional email: 1; AI: 2 |
| api-go | go | — | 1 | 2 | 2 | 1 | 1 | 1 | 1 | Transactional email: 1 |
| api-hono | typescript | — | 1 | 2 | 4 | 2 | 3 | 1 | 5 | Forms and validation: 2; Payments: 1; Transactional email: 1; AI: 2 |
| api-laravel | php | — | 1 | 1 | 1 | 1 | 1 | 1 | 1 | Payments: 1; Transactional email: 1; Languages (i18n): 1 |
| api-nestjs | typescript | — | 1 | 1 | 2 | 1 | 3 | 1 | 4 | Forms and validation: 2; Payments: 1; Transactional email: 1; AI: 2 |
| api-rails | ruby | — | 2 | 1 | 1 | 2 | 1 | 1 | 1 | Payments: 1; Transactional email: 1; Languages (i18n): 1; AI: 1 |
| api-spring-boot | java | — | 2 | 2 | 1 | 1 | — | 1 | 1 | Payments: 1; Transactional email: 1; AI: 1 |
| blog-astro | typescript | 1 | — | — | — | 1 | 3 | 1 | 3 | Animation: 4; Styling: 1; Forms and validation: 2 |
| chrome-extension | typescript | 14 | 1 | — | 1 | 3 | 3 | 1 | 1 | Add-on libraries: 9; Animation: 8; Global state: 3; Server data: 2; Forms and validation: 4; Languages (i18n): 1 |
| cli-node | typescript | — | 1 | 1 | 2 | 1 | 3 | 1 | 5 | Forms and validation: 2; Payments: 1; Transactional email: 1; AI: 2 |
| desktop-electron | typescript | — | 1 | — | — | 1 | 3 | 1 | 1 | Forms and validation: 1 |
| desktop-tauri | typescript | 6 | 1 | — | — | 1 | 3 | 1 | 1 | Animation: 7; Global state: 2; Server data: 2; Forms and validation: 3 |
| discord-bot | typescript | — | 1 | 1 | 2 | 1 | 3 | 1 | 4 | Forms and validation: 2; Payments: 1; Transactional email: 1; AI: 2 |
| docs-fumadocs | typescript | 6 | — | — | 3 | 2 | 3 | 1 | 6 | Add-on libraries: 9; Animation: 7; Global state: 2; Server data: 2; Forms and validation: 3; Languages (i18n): 1 |
| docs-starlight | typescript | 1 | — | — | — | 1 | 3 | 1 | 3 | Animation: 4; Styling: 1; Forms and validation: 2 |
| docs-vitepress | typescript | 4 | — | — | 1 | 2 | 3 | 1 | 3 | Animation: 4; Global state: 1; Forms and validation: 3; Languages (i18n): 1 |
| github-action | typescript | — | 1 | 1 | 2 | 1 | 3 | 1 | 4 | Forms and validation: 2; Payments: 1; Transactional email: 1; AI: 2 |
| ios-swiftui | swift | — | 1 | 1 | 1 | 1 | 1 | 1 | 1 | Server data: 1; Payments: 1 |
| landing-astro | typescript | 1 | — | — | — | 1 | 3 | 1 | 3 | Animation: 4; Styling: 1; Forms and validation: 2 |
| landing-next | typescript | 6 | — | — | 3 | 2 | 3 | 1 | 6 | Add-on libraries: 9; Animation: 7; Global state: 2; Server data: 2; Forms and validation: 3; Languages (i18n): 1 |
| landing-nuxt | typescript | 5 | — | — | 1 | 2 | 3 | 1 | 4 | Animation: 4; Styling: 1; Global state: 1; Server data: 1; Forms and validation: 3; Languages (i18n): 1 |
| landing-sveltekit | typescript | 5 | — | — | 1 | 2 | 3 | 1 | 3 | Animation: 4; Styling: 1; Server data: 1; Forms and validation: 3 |
| mcp-server-python | python | — | 1 | 2 | 1 | 1 | 2 | 1 | 1 | Payments: 1; Transactional email: 1; AI: 2 |
| mcp-server-ts | typescript | — | 1 | 1 | 2 | 1 | 3 | 1 | 5 | Forms and validation: 2; Payments: 1; Transactional email: 1; AI: 2 |
| mobile-expo | typescript | 4 | 1 | — | 2 | 1 | 3 | 1 | 1 | Animation: 2; Global state: 1; Server data: 1; Forms and validation: 3; Languages (i18n): 1 |
| mobile-expo-supabase | typescript | 4 | 1 | — | 2 | 1 | 3 | 1 | 1 | Animation: 2; Global state: 1; Server data: 1; Forms and validation: 3; Languages (i18n): 1 |
| mobile-flutter | dart | — | 1 | 1 | 1 | 1 | 1 | 1 | 1 | Global state: 3; Server data: 2; Languages (i18n): 1 |
| mobile-ignite | typescript | — | 1 | — | 2 | 1 | 3 | 1 | 1 | Animation: 2; Global state: 1; Server data: 1; Forms and validation: 3; Languages (i18n): 1 |
| mobile-ionic-react | typescript | 6 | 1 | — | — | 1 | 3 | 1 | 3 | Add-on libraries: 9; Animation: 7; Global state: 2; Server data: 2; Forms and validation: 3 |
| mobile-kmp | kotlin | — | 1 | 1 | — | 1 | 1 | 1 | 1 | Global state: 1; Server data: 1; Forms and validation: 1; Languages (i18n): 1 |
| monorepo-django-react | python | — | — | — | — | 1 | 1 | 1 | 1 | — |
| monorepo-go | go | — | — | — | — | 1 | 1 | 1 | 1 | — |
| monorepo-nx | typescript | — | — | — | — | 1 | 1 | 1 | 1 | — |
| monorepo-packages | typescript | — | — | — | — | 1 | 2 | 2 | 2 | — |
| monorepo-rails-react | ruby | — | — | — | — | 1 | 1 | 1 | 1 | — |
| monorepo-spring-react | java | — | — | — | — | 1 | 1 | 1 | 1 | — |
| monorepo-t3-turbo | typescript | — | — | — | — | 1 | 1 | 1 | 1 | — |
| monorepo-turbo | typescript | — | — | — | — | 1 | 1 | 1 | 1 | — |
| portfolio-astro | typescript | 1 | — | — | — | 1 | 3 | 1 | 3 | Animation: 4; Styling: 1; Forms and validation: 2 |
| saas-ai-next | typescript | 6 | 3 | 4 | 3 | 2 | 3 | 1 | 6 | Add-on libraries: 9; Animation: 7; Global state: 2; Server data: 2; Forms and validation: 3; Payments: 5; Transactional email: 2; Languages (i18n): 1; AI: 3 |
| saas-django | python | — | 1 | 2 | 1 | 2 | 2 | 1 | 1 | Payments: 1; Transactional email: 1; AI: 2 |
| saas-laravel | php | — | 1 | 1 | 1 | 1 | 1 | 1 | 1 | Payments: 1; Transactional email: 1; Languages (i18n): 1 |
| saas-next-better-auth | typescript | 6 | 3 | 4 | 3 | 2 | 3 | 1 | 6 | Add-on libraries: 9; Animation: 7; Global state: 2; Server data: 2; Forms and validation: 3; Payments: 5; Transactional email: 2; Languages (i18n): 1; AI: 3 |
| saas-next-supabase | typescript | 6 | 3 | 4 | 3 | 2 | 3 | 1 | 6 | Add-on libraries: 9; Animation: 7; Global state: 2; Server data: 2; Forms and validation: 3; Payments: 5; Transactional email: 2; Languages (i18n): 1; AI: 3 |
| saas-nuxt | typescript | — | 3 | 1 | 1 | 2 | 3 | 1 | 4 | Animation: 4; Styling: 1; Global state: 1; Server data: 1; Forms and validation: 3; Payments: 1; Transactional email: 1; Languages (i18n): 1; AI: 2 |
| saas-rails | ruby | — | 2 | 1 | 1 | 2 | 1 | 1 | 1 | Payments: 1; Transactional email: 1; Languages (i18n): 1; AI: 1 |
| saas-sveltekit | typescript | 5 | 2 | 1 | 1 | 2 | 3 | 1 | 3 | Animation: 4; Styling: 1; Server data: 1; Forms and validation: 3; Payments: 1; Transactional email: 1; AI: 2 |
| saas-t3 | typescript | 6 | 3 | 4 | 3 | 2 | 3 | 1 | 6 | Add-on libraries: 9; Animation: 7; Global state: 2; Server data: 2; Forms and validation: 3; Payments: 5; Transactional email: 2; Languages (i18n): 1; AI: 3 |
| saas-tanstack-start | typescript | 6 | 1 | — | — | 1 | 3 | 1 | 1 | Add-on libraries: 9; Animation: 7; Global state: 2; Server data: 2; Forms and validation: 3 |
| slack-app | typescript | — | 1 | 1 | 2 | 1 | 3 | 1 | 4 | Forms and validation: 2; Payments: 1; Transactional email: 1; AI: 2 |
| spa-vite-react | typescript | 6 | 1 | — | — | 1 | 3 | 1 | 3 | Add-on libraries: 9; Animation: 7; Global state: 2; Server data: 2; Forms and validation: 3 |
| vscode-extension | typescript | — | 1 | 1 | 2 | 1 | 3 | 1 | 1 | Forms and validation: 2; Payments: 1; Transactional email: 1 |
| web-angular | typescript | 2 | 1 | — | 1 | 1 | 3 | 1 | 1 | Forms and validation: 1; Languages (i18n): 1 |
| web-astro | typescript | 1 | 1 | — | — | 1 | 3 | 1 | 3 | Animation: 4; Styling: 1; Forms and validation: 2 |
| web-laravel | php | — | 1 | 1 | 1 | 1 | 1 | 1 | 1 | Payments: 1; Transactional email: 1; Languages (i18n): 1 |
| web-next | typescript | 6 | 3 | 4 | 3 | 2 | 3 | 1 | 6 | Add-on libraries: 9; Animation: 7; Global state: 2; Server data: 2; Forms and validation: 3; Payments: 5; Transactional email: 2; Languages (i18n): 1; AI: 3 |
| web-nuxt | typescript | 5 | 3 | 1 | 1 | 2 | 3 | 1 | 4 | Animation: 4; Styling: 1; Global state: 1; Server data: 1; Forms and validation: 3; Payments: 1; Transactional email: 1; Languages (i18n): 1; AI: 2 |
| web-rails | ruby | — | 2 | 1 | 1 | 2 | 1 | 1 | 1 | Payments: 1; Transactional email: 1; Languages (i18n): 1; AI: 1 |
| web-react-router | typescript | 6 | 1 | — | — | 1 | 3 | 1 | 1 | Add-on libraries: 9; Animation: 7; Global state: 2; Server data: 2; Forms and validation: 3 |
| web-sveltekit | typescript | 5 | 2 | 1 | 1 | 2 | 3 | 1 | 3 | Animation: 4; Styling: 1; Server data: 1; Forms and validation: 3; Payments: 1; Transactional email: 1; AI: 2 |
| web-tanstack-start | typescript | 6 | 1 | — | — | 1 | 3 | 1 | 1 | Add-on libraries: 9; Animation: 7; Global state: 2; Server data: 2; Forms and validation: 3 |
| web-vue-vite | typescript | 4 | 1 | — | 1 | 2 | 3 | 1 | 3 | Animation: 4; Global state: 1; Forms and validation: 3; Languages (i18n): 1 |

Las entradas con SDK o configuración pendiente lo indican en sus instrucciones y tareas iniciales. Una opción de despliegue configura o describe el destino; no crea cuentas, contrata planes ni demuestra un despliegue externo. Las bibliotecas sin logo público usan un icono semántico de su categoría.
