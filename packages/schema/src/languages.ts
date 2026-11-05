import type { PackageManager } from "./resolve";

/**
 * Languages a kit can be written in. `icon` is a Simple Icons slug (the website
 * draws it); kits declare `language` or get it from their package manager.
 */
export const LANGUAGES = [
  { id: "typescript", label: "TypeScript", icon: "typescript", description: "Web, móvil, APIs y extensiones con Node, Bun o Deno." },
  { id: "python", label: "Python", icon: "python", description: "APIs y backends con FastAPI o Django." },
  { id: "go", label: "Go", icon: "go", description: "Servicios HTTP rápidos con la biblioteca estándar." },
  { id: "ruby", label: "Ruby", icon: "ruby", description: "Apps completas con Ruby on Rails." },
  { id: "php", label: "PHP", icon: "php", description: "Apps y APIs con Laravel." },
  { id: "java", label: "Java", icon: "openjdk", description: "APIs con Spring Boot." },
  { id: "swift", label: "Swift", icon: "swift", description: "Apps nativas de iOS con SwiftUI." },
  { id: "rust", label: "Rust", icon: "rust", description: "Servicios seguros y rápidos." },
  { id: "kotlin", label: "Kotlin", icon: "kotlin", description: "Android y servidores en la JVM." },
  { id: "dart", label: "Dart", icon: "dart", description: "Apps multiplataforma con Flutter." },
  { id: "elixir", label: "Elixir", icon: "elixir", description: "Sistemas concurrentes con Phoenix." },
  { id: "csharp", label: "C#", icon: "dotnet", description: "APIs y apps con .NET." },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["id"];
export const LANGUAGE_IDS = LANGUAGES.map((l) => l.id) as [LanguageId, ...LanguageId[]];

const BY_PM: Partial<Record<PackageManager, LanguageId>> = {
  npm: "typescript",
  pnpm: "typescript",
  bun: "typescript",
  deno: "typescript",
  uv: "python",
  pip: "python",
  go: "go",
  swift: "swift",
  bundler: "ruby",
  composer: "php",
  maven: "java",
  cargo: "rust",
};

/** The kit's language: declared, or from its first package manager. */
export function kitLanguage(kit: { language?: LanguageId; packageManagers: readonly PackageManager[] }): LanguageId {
  return kit.language ?? BY_PM[kit.packageManagers[0]!] ?? "typescript";
}
