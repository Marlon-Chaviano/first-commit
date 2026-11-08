/**
 * The zod-free part of @kits/schema, for client components: brand, languages, categories, agents,
 * slugs. Importing "@kits/schema" from a client component pulls every schema (and zod) into the
 * browser bundle; import from "@kits/schema/light" when this is all you need.
 */
export * from "./brand";
export * from "./catalog";
export * from "./languages";
export * from "./slug";
export { PACKAGE_MANAGER_IDS as PACKAGE_MANAGERS } from "./package-managers";
export type { RegistryEntry } from "./index";
