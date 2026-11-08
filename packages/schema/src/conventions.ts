import type { LanguageId } from "./languages";

/**
 * The language's house rules, written into AGENTS.md. Short on purpose: the kit's
 * `instructions` and the installed skills carry the framework-specific detail.
 */
export const LANGUAGE_CONVENTIONS: Record<LanguageId, string[]> = {
  typescript: [
    "Keep `strict` TypeScript: no `any`, no `@ts-ignore`; narrow `unknown` instead.",
    "Validate data that crosses a boundary (requests, forms, env, third-party APIs) before using it.",
    "Use the project's package manager and lockfile; don't mix managers.",
  ],
  python: [
    "Type-annotate every function and keep the code passing the project's linter.",
    "Install packages inside the project's virtual environment, never globally.",
    "Write a pytest test next to every behavior change.",
  ],
  go: [
    "Run `gofmt` and `go vet` before finishing; keep errors wrapped with context (`fmt.Errorf(\"…: %w\", err)`).",
    "Pass `context.Context` as the first argument of anything that does I/O.",
    "Prefer the standard library; add a dependency only when it clearly earns its place.",
  ],
  ruby: [
    "Follow Rails conventions over configuration; put business logic in models or service objects, not controllers.",
    "Add a test for every behavior change and run the suite before finishing.",
  ],
  php: [
    "Follow PSR-12 and Laravel conventions; validate input with Form Requests.",
    "Add a test for every behavior change and run the suite before finishing.",
  ],
  java: [
    "Use constructor injection, records for DTOs and validation annotations on inputs.",
    "Add a test for every behavior change and run `./mvnw test` before finishing.",
  ],
  swift: [
    "Use Swift concurrency (async/await, actors) and keep UI updates on the main actor.",
    "Prefer value types and `@Observable` models; keep views small.",
  ],
  rust: [
    "Run `cargo fmt` and `cargo clippy` before finishing; no `unwrap()` outside tests.",
    "Return `Result` with meaningful error types instead of panicking.",
  ],
  kotlin: [
    "Use coroutines and Flow for async work; keep state in ViewModels, not composables.",
    "Run the Gradle checks (`./gradlew check`) before finishing.",
  ],
  dart: [
    "Keep `flutter analyze` clean and widgets small and composable.",
    "Add a widget or unit test for every behavior change.",
  ],
  elixir: [
    "Run `mix format` and `mix test` before finishing; let processes crash and be supervised.",
  ],
  csharp: [
    "Keep nullable reference types on and use `async` all the way down.",
    "Add a test for every behavior change and run `dotnet test` before finishing.",
  ],
};
