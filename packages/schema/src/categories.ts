/**
 * Library categories of the shared catalog. Each one becomes an option of any
 * kit that declares it in `libraries` (key → default). Order = order in the UI.
 */
export const LIBRARY_CATEGORIES = [
  { kind: "components", key: "components", optionId: "components", type: "select", label: "Componentes de UI", description: "La biblioteca que tu agente usará para toda la interfaz." },
  { kind: "addon", key: "addons", optionId: "component-addons", type: "multi", label: "Bibliotecas complementarias", description: "Registros de shadcn con componentes más vistosos. Requieren shadcn/ui." },
  { kind: "animation", key: "animation", optionId: "animation", type: "multi", label: "Animaciones" },
  { kind: "auth", key: "auth", optionId: "auth", type: "select", label: "Autenticación", description: "Login y sesiones." },
  { kind: "database", key: "database", optionId: "database", type: "select", label: "Base de datos", description: "ORM, cliente y migraciones." },
  { kind: "payments", key: "payments", optionId: "payments", type: "select", label: "Pagos" },
  { kind: "email", key: "email", optionId: "email", type: "select", label: "Email transaccional" },
  { kind: "i18n", key: "i18n", optionId: "i18n", type: "select", label: "Idiomas (i18n)" },
  { kind: "ai", key: "ai", optionId: "ai", type: "multi", label: "IA", description: "SDKs para llamar a modelos desde tu app." },
  { kind: "observability", key: "observability", optionId: "observability", type: "multi", label: "Observabilidad", description: "Errores, analítica de producto y rendimiento, ya configurados." },
  { kind: "testing", key: "testing", optionId: "testing", type: "multi", label: "Tests" },
  { kind: "quality", key: "quality", optionId: "quality", type: "multi", label: "Calidad de código", description: "Formato, lint y hooks de git." },
  { kind: "ci", key: "ci", optionId: "ci", type: "multi", label: "Integración continua" },
  { kind: "deploy", key: "deploy", optionId: "deploy", type: "select", label: "Despliegue" },
  { kind: "workflow", key: "workflow", optionId: "workflow", type: "multi", label: "Skills de trabajo", description: "Cómo trabaja tu agente: planificar, depurar, revisar y mejorar la arquitectura." },
] as const;

export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];
export type LibraryKind = LibraryCategory["kind"];
export const LIBRARY_KINDS = LIBRARY_CATEGORIES.map((c) => c.kind) as [LibraryKind, ...LibraryKind[]];

/** key in `libraries` → option id, e.g. addons → "component-addons". */
export const LIBRARY_OPTION_IDS = Object.fromEntries(LIBRARY_CATEGORIES.map((c) => [c.key, c.optionId])) as {
  [C in LibraryCategory as C["key"]]: C["optionId"];
};
