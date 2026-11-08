/**
 * Everything that depends on the product's name, domain or repository.
 * The name and the domain are not final: renaming the product means editing
 * this file plus "name" and "bin" in packages/cli/package.json.
 */
export const BRAND = {
  /** Product name shown on the website (and in the pixel wordmark, one line per word). */
  name: "first-commit",
  /**
   * npm package and command: `npx create-first-commit landing-next`. The plain
   * "first-commit" package is taken on npm; the create-* name also reads as what it does.
   */
  cli: "create-first-commit",
  /** Command name when installed globally (`npm i -g create-first-commit`). */
  bin: "first-commit",
  /** Website and API. The CLI's telemetry posts here. */
  siteUrl: "https://first-commit.dev",
  /** Public GitHub repository that hosts the official registry. */
  repo: "Marlon-Chaviano/first-commit",
  branch: "main",
} as const;

/** Who makes the product (footer credit and contact). */
export const AUTHOR = {
  name: "Marlon Chaviano",
  /** The site account that signs the official kits (kit.json `author`, /u/<handle>). */
  handle: "marlon-chaviano",
  github: "https://github.com/Marlon-Chaviano",
  email: "chavianomarlon@gmail.com",
} as const;

export const REPO_URL = `https://github.com/${BRAND.repo}`;
/** giget source for official kits. */
export const REGISTRY_SOURCE = `gh:${BRAND.repo}/registry`;
/** Raw files of the registry (index.json, libraries.json, kit.schema.json). */
export const REGISTRY_RAW_BASE = `https://raw.githubusercontent.com/${BRAND.repo}/${BRAND.branch}/registry`;

/** "npx create-first-commit mobile-expo" */
export function cliCommand(args = ""): string {
  return `npx ${BRAND.cli} ${args}`.trim();
}

/** The skill that teaches agents to use the CLI (skills/kits in the repo). */
export const KITS_SKILL = `${BRAND.repo}@${BRAND.name}`;
/**
 * Whether KITS_SKILL is published on skills.sh. While false, kits don't
 * install it (the install would fail). Set to true in phase 8, after pushing the repo.
 */
export const KITS_SKILL_PUBLISHED = true;
