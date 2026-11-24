import "server-only";

import type { BrandProfile } from "@kits/schema";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";

import { matchingTemplates, templatePath, type BrandTemplate } from "@/features/brands/templates";
import { CATALOG_PAGE_SIZE } from "@/lib/catalog-page";
import { db } from "./db";
import { brandProfiles as brands } from "./db/schema";

type Card = Pick<BrandProfile, "colors" | "fonts" | "radius" | "title"> & {
  id: string;
  href: string;
  logo?: string;
  publisher: string | null;
};

function officialCard({ id, title, colors, fonts, radius }: BrandTemplate): Card {
  return { id, title, colors, fonts, radius, href: templatePath(id), logo: `/brand-templates/${id}.svg`, publisher: null };
}

/** Lead with a row of official templates, then recent public profiles, then the remaining templates. */
export async function brandCatalogPage(page = 1, query = "") {
  const templates = matchingTemplates(query);
  const lead = Math.min(3, templates.length);
  const term = query.trim().toLowerCase();
  const matches = and(eq(brands.isPrivate, false), term ? sql`strpos(lower(concat_ws(' ', ${brands.title}, ${brands.slug},
    ${brands.profile}->'fonts'->>'sans', ${brands.profile}->'fonts'->>'heading', ${brands.profile}->'fonts'->>'mono')), ${term}) > 0` : undefined);
  const publicCount = db ? (await db.select({ n: count() }).from(brands).where(matches))[0]!.n : 0;
  const start = (page - 1) * CATALOG_PAGE_SIZE;
  const end = start + CATALOG_PAGE_SIZE;
  const items = templates.slice(start, Math.min(end, lead)).map(officialCard);
  const offset = Math.max(0, start - lead);
  const limit = Math.min(publicCount, end - lead) - offset;
  if (db && limit > 0) {
    const p = brands.profile;
    const logo = sql`coalesce(${p}->'assets'->>'logo', ${p}->>'logo', ${p}->'assets'->>'icon')`;
    const rows = await db.select({
      slug: brands.slug, title: brands.title, colors: sql<BrandProfile["colors"]>`${p}->'colors'`,
      fonts: sql<BrandProfile["fonts"]>`coalesce(${p}->'fonts', '{}'::jsonb)`,
      radius: sql<string | null>`${p}->>'radius'`,
      logo: sql<string | null>`case when length(${logo}) <= 32768 then ${logo} end`,
    }).from(brands).where(matches).orderBy(desc(brands.createdAt), asc(brands.slug)).offset(offset).limit(limit);
    for (const { slug, radius, logo, ...preview } of rows) {
      items.push({ ...preview, id: slug, radius: radius ?? undefined, logo: logo ?? undefined,
        href: `/brands/${slug}`, publisher: slug.split("/")[0]! });
    }
  }
  items.push(...templates.slice(Math.max(lead, start - publicCount), Math.max(lead, end - publicCount)).map(officialCard));
  const total = templates.length + publicCount;
  return { items, total, nextPage: end < total ? page + 1 : null };
}

export type BrandCatalogPage = Awaited<ReturnType<typeof brandCatalogPage>>;
