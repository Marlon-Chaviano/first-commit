import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { catalogSchema, LIBRARY_CATEGORIES, kitLanguage } from "@kits/schema";
import { loadRegistryKits } from "@kits/schema/node";

const root = join(import.meta.dirname, "..");
const catalog = catalogSchema.parse(JSON.parse(readFileSync(join(root, "registry/libraries.json"), "utf8")));
const kits = await loadRegistryKits(join(root, "registry"));
const columns = ["components", "auth", "database", "observability", "testing", "quality", "ci", "deploy"];
const rows = kits.map((kit) => {
  const count = (id: string) => kit.options.find((o) => o.id === id)?.choices.filter((c) => c.id !== "none").length ?? 0;
  const other = LIBRARY_CATEGORIES.filter((c) => !columns.includes(c.optionId) && !["design", "security", "workflow"].includes(c.kind))
    .map((c) => ({ label: c.label, count: count(c.optionId) })).filter((c) => c.count > 0)
    .map((c) => `${c.label}: ${c.count}`).join("; ") || "—";
  return `| ${kit.name} | ${kitLanguage(kit)} | ${columns.map((c) => count(c) || "—").join(" | ")} | ${other} |`;
});
const body = `# Cobertura del catálogo

Generado con \`pnpm registry:coverage\`. ${kits.length} kits y ${catalog.length} entradas de catálogo.

La validación del catálogo del 14 de noviembre de 2026 se conserva en [catalog-validation.json](catalog-validation.json) y [catalog-package-sources.json](catalog-package-sources.json). La matriz del kit \`api-nestjs\` incluye el contrato OpenAPI y Swagger UI. La del kit \`monorepo\` comprueba Next.js con NestJS y Swagger UI.

Los números cuentan opciones disponibles, sin «None»; no significan que todas estén instaladas ni verificadas en cada combinación. «—» indica que esa categoría no se ofrece en el configurador: puede venir incluida en el kit base o no ser pertinente. El pack general de Security y el de flujo de trabajo están disponibles en los ${kits.length} kits y no cuentan como bibliotecas de estas columnas.

Los frameworks y plataformas se resuelven con \`loadRegistryKits\`, igual que en CLI y web. Las extensiones reciben destinos de publicación propios; los proyectos de escritorio no reciben hosting web. Los monorepos conservan las dependencias dentro de cada servicio: sus opciones comunes cubren CI, comprobaciones y despliegue por servicio, sin instalar bibliotecas del frontend en la raíz.

| Kit | Lenguaje | UI | Auth | Datos | Observabilidad | Tests | Calidad | CI | Despliegue | Otras opciones |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${rows.join("\n")}

Las entradas con SDK o configuración pendiente lo indican en sus instrucciones y tareas iniciales. Una opción de despliegue configura o describe el destino; no crea cuentas, contrata planes ni demuestra un despliegue externo. Las bibliotecas sin logo público usan un icono semántico de su categoría.
`;
writeFileSync(join(root, "docs/catalog-coverage.md"), body);
console.log(`✓ Coverage for ${kits.length} kits → docs/catalog-coverage.md`);
