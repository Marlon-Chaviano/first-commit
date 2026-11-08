import { TECH_ICON_KEYS, TECH_PATHS } from "./tech-icon-paths";

/** A monochrome logo: Simple Icons' slug and SVG path (24×24 viewBox). */
export interface Logo {
  slug: string;
  path: string;
}

/**
 * Agents, languages and package managers: the small set TechIcon draws on every page (generated
 * from lib/logo-sources.ts). Library logos live in lib/logos.ts, only where they're shown.
 */
export const TECH_ICONS: Record<string, Logo> = Object.fromEntries(Object.entries(TECH_ICON_KEYS).map(([key, slug]) => [key, { slug, path: TECH_PATHS[slug]! }]));
