import { packageManager, type PackageManager } from "./package-managers";

/**
 * Languages a kit can be written in. `icon` is a Simple Icons slug (the website
 * draws it); kits declare `language` or get it from their package manager.
 */
export const LANGUAGES = [
  { id: "typescript", label: "TypeScript", icon: "typescript", description: "Web, mobile, APIs and extensions with Node, Bun or Deno." },
  { id: "python", label: "Python", icon: "python", description: "APIs and backends with FastAPI or Django." },
  { id: "go", label: "Go", icon: "go", description: "Fast HTTP services with the standard library." },
  { id: "ruby", label: "Ruby", icon: "ruby", description: "Full apps with Ruby on Rails." },
  { id: "php", label: "PHP", icon: "php", description: "Apps and APIs with Laravel." },
  { id: "java", label: "Java", icon: "openjdk", description: "APIs with Spring Boot." },
  { id: "swift", label: "Swift", icon: "swift", description: "Native iOS apps with SwiftUI." },
  { id: "rust", label: "Rust", icon: "rust", description: "Safe, fast services." },
  { id: "kotlin", label: "Kotlin", icon: "kotlin", description: "Android and servers on the JVM." },
  { id: "dart", label: "Dart", icon: "dart", description: "Cross-platform apps with Flutter." },
  { id: "elixir", label: "Elixir", icon: "elixir", description: "Concurrent systems with Phoenix." },
  { id: "csharp", label: "C#", icon: "dotnet", description: "APIs and apps with .NET." },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["id"];
export const LANGUAGE_IDS = LANGUAGES.map((l) => l.id) as [LanguageId, ...LanguageId[]];


/** The kit's language: declared, or from its first package manager. */
export function kitLanguage(kit: { language?: LanguageId; packageManagers: readonly PackageManager[] }): LanguageId {
  return kit.language ?? (packageManager(kit.packageManagers[0] ?? "npm").language as LanguageId);
}

/** A registry entry's language (entries built before `language` existed default to TypeScript). */
export function entryLanguage(entry: { language?: LanguageId }): LanguageId {
  return entry.language ?? "typescript";
}

export function languageLabel(id: LanguageId): string {
  return LANGUAGES.find((l) => l.id === id)?.label ?? id;
}
