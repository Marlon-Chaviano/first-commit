import { brandTemplatePage } from "@/features/brands/templates";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") ?? 1);
  if (!Number.isSafeInteger(page) || page < 1) return Response.json({ error: "Invalid page" }, { status: 400 });
  return Response.json(brandTemplatePage(page, params.get("q") ?? ""), {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=3600" },
  });
}
