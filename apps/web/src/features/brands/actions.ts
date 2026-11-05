"use server";

import { detectFromSite, readHtml, type BrandDetection } from "@kits/schema";
import { revalidatePath } from "next/cache";

import { BrandError, deleteBrand, saveBrand } from "@/server/brands";
import { OrgError } from "@/server/orgs";
import { safeFetchText, UnsafeUrlError } from "@/server/safe-fetch";
import { getViewer } from "@/server/session";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function saveBrandAction(owner: string, profile: unknown): Promise<Result<string>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Inicia sesión" };
  try {
    const slug = await saveBrand(viewer, owner, profile);
    revalidatePath("/cuenta/marcas");
    return { ok: true, data: slug };
  } catch (error) {
    if (error instanceof BrandError || error instanceof OrgError) return { ok: false, error: error.message };
    console.error("[brands]", error);
    return { ok: false, error: "No se pudo guardar" };
  }
}

export async function deleteBrandAction(slug: string): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Inicia sesión" };
  try {
    await deleteBrand(viewer, slug);
    revalidatePath("/cuenta/marcas");
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof BrandError || error instanceof OrgError) return { ok: false, error: error.message };
    return { ok: false, error: "No se pudo borrar" };
  }
}

/** Detects colors, fonts and name from a public website (its HTML, theme-color and CSS). */
export async function detectBrandFromUrlAction(input: string): Promise<Result<BrandDetection>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Inicia sesión" };
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Escribe la dirección de la web" };
  try {
    const page = await safeFetchText(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const html = readHtml(page.text);
    // A handful of stylesheets is enough to find the theme; each one is fetched with the same protections.
    const css = await Promise.all(
      html.stylesheets.slice(0, 5).map((href) =>
        safeFetchText(new URL(href, page.url).toString(), { maxBytes: 500_000, accept: "text/css,*/*" })
          .then((r) => r.text)
          .catch(() => ""),
      ),
    );
    const detection = detectFromSite(html, css.join("\n"));
    if (!Object.keys(detection.profile.colors).length && !detection.profile.title) {
      return { ok: false, error: "No se encontraron colores en esa web. Prueba con su hoja de estilos o con el logo." };
    }
    return { ok: true, data: detection };
  } catch (error) {
    if (error instanceof UnsafeUrlError) return { ok: false, error: error.message };
    return { ok: false, error: `No se pudo leer la web: ${(error as Error).message}` };
  }
}
