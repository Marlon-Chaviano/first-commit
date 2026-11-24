import { getBrand } from "@/server/brands";
import { getRequestUser } from "@/server/session";

/** GET /api/v1/brands/<owner>/<name> — the profile, for `create-first-commit brand` and `init --brand`. */
export async function GET(request: Request, { params }: RouteContext<"/api/v1/brands/[...slug]">) {
  const user = await getRequestUser(request);
  const found = await getBrand((await params).slug.join("/"), user);
  if (!found) return Response.json({ error: "Brand profile not found" }, { status: 404, headers: { "cache-control": "private, no-store" } });
  return Response.json(found.profile, { headers: { "cache-control": "private, no-store" } });
}
