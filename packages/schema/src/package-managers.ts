/**
 * Everything first-commit knows about each package manager, one row each.
 * Adding a package manager is adding a row here (plus its logo on the website).
 */
interface PackageManagerProfile {
  /** Language of the kits that use it (see LANGUAGES). */
  language: string;
  /** {{pmx}}: run a package's binary without installing it. */
  exec: string;
  /** How dependencies are added; managers without an "add" command explain where they go instead. */
  add: { deps: string; dev: string };
  /** Lockfiles that reveal it in an existing project. */
  lockfiles: string[];
  /** JavaScript managers run Node CLIs (the skills CLI) themselves; the rest use npx. */
  runsNode?: boolean;
  /** GitHub Actions steps that make it available (npm comes with setup-node). */
  ciSetup?: string;
}

const manual = (where: string) => ({
  deps: `echo 'Add {{packages}} to ${where}' >&2 && exit 1`,
  dev: `echo 'Add {{packages}} to ${where} (development/tests only)' >&2 && exit 1`,
});

const PROFILES = {
  npm: { language: "typescript", exec: "npx", add: { deps: "npm install {{packages}}", dev: "npm install -D {{packages}}" }, lockfiles: ["package-lock.json"], runsNode: true },
  pnpm: {
    language: "typescript",
    exec: "pnpm dlx",
    add: { deps: "pnpm add {{packages}}", dev: "pnpm add -D {{packages}}" },
    lockfiles: ["pnpm-lock.yaml"],
    runsNode: true,
    ciSetup: "      - uses: pnpm/action-setup@v4\n        with:\n          version: 10\n",
  },
  bun: {
    language: "typescript",
    exec: "bunx",
    add: { deps: "bun add {{packages}}", dev: "bun add -d {{packages}}" },
    lockfiles: ["bun.lock", "bun.lockb"],
    runsNode: true,
    ciSetup: "      - uses: oven-sh/setup-bun@v2\n",
  },
  deno: { language: "typescript", exec: "deno run -A", add: { deps: "deno add {{packages}}", dev: "deno add --dev {{packages}}" }, lockfiles: ["deno.lock"] },
  uv: { language: "python", exec: "uvx", add: { deps: "uv add {{packages}}", dev: "uv add --dev {{packages}}" }, lockfiles: ["uv.lock"] },
  // Kits for pip create a virtualenv in .venv (see the FastAPI kit).
  pip: { language: "python", exec: "pipx run", add: { deps: ".venv/bin/pip install {{packages}}", dev: ".venv/bin/pip install {{packages}}" }, lockfiles: [] },
  go: { language: "go", exec: "go run", add: { deps: "go get {{packages}}", dev: "go get -tool {{packages}}" }, lockfiles: ["go.sum"] },
  // Xcode projects (XcodeGen) declare Swift packages in project.yml; there's no CLI to add them.
  swift: { language: "swift", exec: "swift run", add: manual("packages: in project.yml and run xcodegen generate"), lockfiles: ["Package.resolved"] },
  bundler: { language: "ruby", exec: "bundle exec", add: { deps: "bundle add {{packages}}", dev: "bundle add {{packages}} --group development,test" }, lockfiles: ["Gemfile.lock"] },
  composer: { language: "php", exec: "composer exec", add: { deps: "composer require {{packages}}", dev: "composer require --dev {{packages}}" }, lockfiles: ["composer.lock"] },
  // Maven and Gradle have no "add" command: dependencies go in the build file.
  maven: { language: "java", exec: "./mvnw", add: manual("<dependencies> in pom.xml"), lockfiles: [] },
  cargo: { language: "rust", exec: "cargo run", add: { deps: "cargo add {{packages}}", dev: "cargo add --dev {{packages}}" }, lockfiles: ["Cargo.lock"] },
  gradle: { language: "kotlin", exec: "./gradlew", add: manual("gradle/libs.versions.toml and the module's build.gradle.kts"), lockfiles: [] },
  flutter: { language: "dart", exec: "dart run", add: { deps: "flutter pub add {{packages}}", dev: "flutter pub add --dev {{packages}}" }, lockfiles: ["pubspec.lock"] },
} satisfies Record<string, PackageManagerProfile>;

export type PackageManager = keyof typeof PROFILES;

/** JavaScript managers plus the ones used by kits in other languages. */
export const PACKAGE_MANAGER_IDS = Object.keys(PROFILES) as [PackageManager, ...PackageManager[]];

export function packageManager(pm: PackageManager): Readonly<PackageManagerProfile> {
  return PROFILES[pm];
}

/** The command that runs a Node CLI (the skills CLI) in a project of this manager. */
export function nodeRunner(pm: PackageManager): string {
  return packageManager(pm).runsNode ? PROFILES[pm].exec : "npx";
}

/** `pnpm dlx <cli>` / `bunx <cli>` → that manager; plain npx (or anything else) → undefined. */
export function pmFromUserAgent(userAgent: string): PackageManager | undefined {
  return (["pnpm", "bun"] as const).find((pm) => userAgent.startsWith(pm));
}

/** A JavaScript project's manager from its lockfile (npm when there's none). */
export function pmFromLockfiles(exists: (file: string) => boolean): PackageManager {
  return (["pnpm", "bun"] as const).find((pm) => PROFILES[pm].lockfiles.some(exists)) ?? "npm";
}
