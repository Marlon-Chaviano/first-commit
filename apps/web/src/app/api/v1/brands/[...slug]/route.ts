import { cliCommand } from "@kits/schema";

import { getBrand } from "@/server/brands";
import { getRequestUser } from "@/server/session";

/** GET /api/v1/brands/<owner>/<name> — the profile, for `create-first-commit brand` and `init --brand`. Private: owner or org members. */
export async function GET(request: Request, { params }: RouteContext<"/api/v1/brands/[...slug]">) {
  const user = await getRequestUser(request);
  if (!user) return Response.json({ error: `A token is missing (${cliCommand("login")} or KITS_TOKEN)` }, { status: 401 });
  const found = await getBrand((await params).slug.join("/"), user);
  if (!found) return Response.json({ error: "Brand profile not found" }, { status: 404 });
  return Response.json(found.profile, { headers: { "cache-control": "private, no-store" } });
}
