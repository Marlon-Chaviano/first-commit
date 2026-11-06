import { AUTHOR, REPO_URL } from "@kits/schema";
import type { Route } from "next";

/** The docs, grouped as in the sidebar. The footer and the sitemap read the same list. */
export const DOCS_SECTIONS = [
  {
    title: "Get started",
    pages: [
      { href: "/docs", label: "Introduction" },
      { href: "/docs/cli", label: "CLI" },
      { href: "/docs/faq", label: "FAQ" },
    ],
  },
  {
    title: "Create kits",
    pages: [
      { href: "/docs/create-kit", label: "Create a kit" },
      { href: "/docs/reference", label: "kit.json reference" },
      { href: "/docs/libraries", label: "Library catalog" },
    ],
  },
  {
    title: "Use kits",
    pages: [
      { href: "/docs/maintain", label: "Maintain your project" },
      { href: "/docs/agents", label: "From your agent" },
      { href: "/docs/brands", label: "Brand profiles" },
      { href: "/docs/api", label: "API" },
    ],
  },
] as const;

export interface DocsPage {
  href: Route;
  label: string;
}

/** Every docs page in sidebar order (previous/next, sitemap, the docs index). */
export const DOCS_PAGES: DocsPage[] = DOCS_SECTIONS.flatMap((s): readonly DocsPage[] => s.pages);

/** Footer "Docs" column: the pages most people look for. */
export const FOOTER_DOCS = [
  { href: "/docs", label: "Introduction" },
  { href: "/docs/cli", label: "CLI" },
  { href: "/docs/create-kit", label: "Create a kit" },
  { href: "/docs/api", label: "API" },
  { href: "/docs/faq", label: "FAQ" },
];

/** Footer "Explore" column (on phones the header only fits Kits and Docs). */
export const EXPLORE_LINKS = [
  { href: "/#leaderboard", label: "Kits" },
  { href: "/stacks", label: "Stacks" },
  { href: "/brands", label: "Brands" },
  { href: "/changelog", label: "Changelog" },
];

/** Footer "Project" column. External links open GitHub. */
export const PROJECT_LINKS = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/content-policy", label: "Content policy" },
  { href: REPO_URL, label: "GitHub", external: true },
];

/** Tabs of the account area, also the items of the user menu. */
export const ACCOUNT_TABS = [
  { href: "/account/kits", label: "Kits" },
  { href: "/account/tokens", label: "Tokens" },
  { href: "/account/orgs", label: "Organizations" },
  { href: "/account/brands", label: "Brands" },
  { href: "/account/settings", label: "Settings" },
] as const;

export const CONTACT_EMAIL = AUTHOR.email;
