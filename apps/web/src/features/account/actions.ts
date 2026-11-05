"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";

import { db } from "@/server/db";
import { kitReports, kits } from "@/server/db/schema";
import { publishKit, PublishError, type PublishSource } from "@/server/publish";
import { REGISTRY_TAG } from "@/server/registry";
import { getViewer, isAdmin } from "@/server/session";
import { createApiToken, revokeApiToken } from "@/server/tokens";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function createTokenAction(name: string): Promise<Result<string>> {
  const viewer = await getViewer();
  if (!viewer || !db) return { ok: false, error: "Inicia sesión" };
  const token = await createApiToken(viewer.id, name.trim() || "CLI");
  revalidatePath("/cuenta");
  return { ok: true, data: token };
}

export async function revokeTokenAction(id: string): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer || !db) return { ok: false, error: "Inicia sesión" };
  await revokeApiToken(viewer.id, id);
  revalidatePath("/cuenta");
  return { ok: true, data: undefined };
}

export async function publishAction(source: PublishSource): Promise<Result<{ slug: string; version: string }>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Inicia sesión" };
  try {
    const { slug, version } = await publishKit(viewer, source);
    revalidatePath("/cuenta");
    return { ok: true, data: { slug, version } };
  } catch (error) {
    if (error instanceof PublishError) return { ok: false, error: error.message };
    console.error("[publish]", error);
    return { ok: false, error: "No se pudo publicar" };
  }
}

/** Owner retires (or brings back) their kit; admins can also hide it. */
export async function setKitStatusAction(slug: string, status: "active" | "retired" | "hidden"): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer || !db) return { ok: false, error: "Inicia sesión" };
  const kit = (await db.select().from(kits).where(eq(kits.slug, slug)).limit(1))[0];
  if (!kit || kit.official) return { ok: false, error: "Kit no encontrado" };
  // Hiding (and un-hiding) is moderation: admins only. Retiring/reactivating: the owner or an admin.
  const moderation = status === "hidden" || kit.status === "hidden";
  const allowed = isAdmin(viewer) || (!moderation && kit.ownerId === viewer.id);
  if (!allowed) return { ok: false, error: "No tienes permiso" };
  await db.update(kits).set({ status, updatedAt: new Date() }).where(eq(kits.id, kit.id));
  revalidateTag(REGISTRY_TAG, { expire: 0 });
  revalidateTag(`kit:${slug}`, { expire: 0 });
  revalidatePath("/cuenta");
  revalidatePath("/admin");
  return { ok: true, data: undefined };
}

export async function setReportStatusAction(id: string, status: "resolved" | "dismissed" | "open"): Promise<Result> {
  const viewer = await getViewer();
  if (!isAdmin(viewer) || !db) return { ok: false, error: "No tienes permiso" };
  await db.update(kitReports).set({ status }).where(and(eq(kitReports.id, id)));
  revalidatePath("/admin");
  return { ok: true, data: undefined };
}

/** Admin: feature a community kit on the home page and in the next newsletter (or stop featuring it). */
export async function setKitFeaturedAction(slug: string, featured: boolean): Promise<Result> {
  const viewer = await getViewer();
  if (!isAdmin(viewer) || !db) return { ok: false, error: "No tienes permiso" };
  await db.update(kits).set({ featuredAt: featured ? new Date() : null }).where(and(eq(kits.slug, slug), eq(kits.official, false)));
  revalidateTag(REGISTRY_TAG, { expire: 0 });
  revalidatePath("/admin");
  return { ok: true, data: undefined };
}
