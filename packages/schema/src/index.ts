export * from "./brand";
export * from "./extends";
export * from "./schema";
export * from "./resolve";
export * from "./categories";
export * from "./libraries";
export * from "./agents";
export * from "./plan";
export * from "./verify";
export * from "./lock";
export * from "./telemetry";
export * from "./recommend";
export * from "./stacks";
export * from "./languages";
export * from "./brand-profile";
export * from "./brand-detect";

/** Entry in registry/index.json — what `create-first-commit list` and the website show before loading a kit. */
export interface RegistryEntry {
  name: string;
  version: string;
  /** Parent kit, when this kit uses `extends`. */
  extends?: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  skills: number;
  options: string[];
  /** Main language (LANGUAGES id). */
  language?: string;
  /** Catalog libraries the kit offers (names), so the ranking can be searched by library. */
  libraries?: string[];
  /** Official registry kit (vs. a published community kit). */
  official?: boolean;
  /** Community kits: the owner's handle. */
  owner?: string;
}
