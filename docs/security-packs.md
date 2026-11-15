# Pack de seguridad

Todos los kits oficiales seleccionan `libraries.security: ["security-pack"]`: un único pack general de 12 skills para la seguridad del proyecto que se va a crear. Cubre código, autenticación, permisos, web/APIs, móvil, infraestructura, secretos y dependencias. Las revisiones de LLM/MCP pertenecen al mismo pack y solo se aplican cuando el proyecto implementa esas funcionalidades. Usar un agente para programar no convierte el proyecto en una aplicación de IA. Un kit de la comunidad puede incorporar el pack declarando esa categoría.

El catálogo es la fuente única (`registry/libraries.json`): el configurador, los comandos del CLI y el MCP reciben las mismas opciones mediante `loadKitFrom` y `expandKit`. Se puede desactivar el pack completo o skills individuales. `security-and-hardening` también pertenece a Essentials: `resolve` la instala una sola vez; quitar el pack de seguridad conserva esa guía general si Essentials sigue seleccionado.

```bash
# Valores por defecto del kit
npx create-first-commit@latest web-next my-app
# Seleccionar explícitamente el pack general
npx create-first-commit@latest web-next my-app --security security-pack
# Desactivar el pack
npx create-first-commit@latest web-next my-app --security none
```

## Selección de fuentes

Revisión inicial: 2026-11-14. Se comprobaron los repositorios originales, el contenido de las skills y una instalación temporal con el CLI de skills. Se priorizan autores originales y organizaciones de seguridad; el nombre «OWASP» en un repositorio de terceros no lo convierte en oficial.

| Área | Fuente original | Skills y propósito |
| --- | --- | --- |
| Código, secretos y dependencias | [OWASP Secure Agent Playbook](https://github.com/OWASP/secure-agent-playbook) | `code-review-security`: revisión basada en Top 10 y ASVS; `secrets-scan`: credenciales expuestas; `sca-audit`: dependencias vulnerables. |
| Web y APIs | [OWASP Secure Agent Playbook](https://github.com/OWASP/secure-agent-playbook) | `web-security-review`: aplicaciones web, sesiones, XSS, SSRF y controles de acceso; `api-security-review`: API Security Top 10:2023. |
| Móvil | [OWASP Secure Agent Playbook](https://github.com/OWASP/secure-agent-playbook) | `mobile-code-review`: permisos, almacenamiento, criptografía y red con MASVS/MASTG; declarar cobertura parcial si falta código nativo o pruebas dinámicas. |
| Infraestructura | [OWASP Secure Agent Playbook](https://github.com/OWASP/secure-agent-playbook) | `iac-security-review`: Terraform/OpenTofu, Kubernetes/Helm y CloudFormation; exposición de recursos, IAM, secretos y cifrado. |
| Diseño seguro y cambios | [Trail of Bits](https://github.com/trailofbits/skills) | `sharp-edges`: APIs y configuraciones fáciles de usar mal; `differential-review`: regresiones, alcance y cobertura de cambios. |
| Implementación | [Addy Osmani](https://github.com/addyosmani/agent-skills) | `security-and-hardening`: guía durante la implementación, límites de confianza y valores seguros. No es una skill oficial de OWASP. |
| Funcionalidades LLM/MCP, cuando existan | [OWASP Secure Agent Playbook](https://github.com/OWASP/secure-agent-playbook) | `llm-risk-assess`: riesgos de aplicaciones LLM; `mcp-server-review`: permisos, herramientas, entradas y exposición de datos. |

La selección cubre implementación y revisión; no instala todas las skills de esos repositorios ni herramientas ofensivas. Las referencias de skills siguen el formato existente `owner/repo@skill`: identifican una skill, no fijan una revisión inmutable de su contenido.

## Archivos auxiliares y estándares

La instalación comprobada con `skills add OWASP/secure-agent-playbook` copia los `SKILL.md` seleccionados pero no los directorios `plays/`, `templates/` y `data/` que viven fuera de sus carpetas. El proyecto de OWASP tiene un [empaquetador propio](https://github.com/OWASP/secure-agent-playbook/blob/main/scripts/package_skills.sh) para crear ZIP autosuficientes; no es el mecanismo usado por nuestro CLI.

Por eso el `usage` del pack, escrito en `AGENTS.md`, enlaza explícitamente las rutas originales de [código](https://github.com/OWASP/secure-agent-playbook/tree/main/plugins/code-security-skills/plays), [IA](https://github.com/OWASP/secure-agent-playbook/tree/main/plugins/ai-security-skills/plays), sus plantillas de hallazgos y los [datos de ASVS, MASVS, MASTG e infraestructura](https://github.com/OWASP/secure-agent-playbook/tree/main/plugins/code-security-skills/data). La skill `web-security-review` usa el play `owasp-top10-web-review.md`. Si un archivo no está instalado, el agente debe consultar esa fuente. Sin acceso al archivo ni a la red, debe declarar la revisión incompleta; no inventar requisitos ni afirmar que pasó.

Se enlazan también [ASVS](https://owasp.org/ASVS/), [Cheat Sheet Series](https://cheatsheetseries.owasp.org/) y [LLM Top 10](https://genai.owasp.org/llm-top-10/). Algunas guías de OWASP siguen citando Top 10:2021; las instrucciones obligan a identificar la edición y no presentar sus números como Top 10:2025.

No se incluye por ahora `security-guidance` del mismo repositorio: requiere `data/asvs/...` como rutas locales, ausentes en una instalación ordinaria con skills. Las reglas del pack sí remiten a ASVS y sus fuentes oficiales.

## Lo que debe hacer el agente

Antes de implementar, identificar activos y límites de confianza y aplicar controles pertinentes al stack: autorización en servidor por recurso, validación, consultas parametrizadas, protección de secretos y configuración segura. Antes de dar por terminados cambios sensibles, revisar código y diff, probar denegación de acceso, aislamiento entre usuarios/organizaciones y entradas malformadas; comprobar abuso y repetición cuando corresponda. Revisar secretos antes de commit y dependencias resueltas antes de publicar o después de cambiarlas.

El agente debe justificar qué revisiones aplican y cuáles no: por ejemplo, una API de Go necesita controles de autenticación, acceso y abuso, pero no una revisión móvil si no tiene cliente móvil ni una revisión LLM si no implementa IA. Tener las 12 skills disponibles no implica cargar ni ejecutar todas para cualquier cambio.

La división anterior en pack general y complemento de IA se elimina. Las versiones de todos los kits se incrementan para que `update` reciba la nueva selección. Al recuperar opciones anteriores con `selectionsFrom(..., { unknown: "ignore" })`, el identificador retirado se descarta y se conserva el pack general; se respeta una selección vacía si el usuario había desactivado seguridad.

Los escáneres y las pruebas activas se limitan al entorno local/de prueba autorizado. Las instrucciones prohíben imprimir secretos, validar credenciales reales o subir código y secretos a servicios externos. Los informes deben incluir alcance, evidencia `archivo:línea`, severidad, correcciones, pruebas, resultados y comprobaciones que no se pudieron ejecutar.

Instalar una skill no obliga técnicamente al modelo a seguirla. El plan sigue usando el comportamiento existente: un fallo de instalación de skills se avisa sin descartar el proyecto generado. El pack no añade hooks obligatorios, escáneres a CI, certificación ASVS ni garantía de seguridad. El agente debe indicar herramientas ausentes y revisiones pendientes; una instalación, un build o un escaneo limpio no prueban que el proyecto sea seguro.
