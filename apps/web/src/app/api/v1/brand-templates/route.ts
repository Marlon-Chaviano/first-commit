import { brandCatalogPage } from "@/server/brand-catalog";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") ?? 1);
  if (!Number.isSafeInteger(page) || page < 1) return Response.json({ error: "Invalid page" }, { status: 400 });
  return Response.json(await brandCatalogPage(page, params.get("q") ?? ""), {
    headers: { "Cache-Control": "no-store" },
  });
}
