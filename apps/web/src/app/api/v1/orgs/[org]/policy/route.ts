import { cliCommand } from "@kits/schema";

import { getOrg, roleIn } from "@/server/orgs";
import { getRequestUser } from "@/server/session";

/**
 * GET /api/v1/orgs/<org>/policy — required and forbidden libraries, for
 * `create-first-commit doctor` (members only; in CI with KITS_TOKEN).
 */
export async function GET(request: Request, { params }: RouteContext<"/api/v1/orgs/[org]/policy">) {
  const user = await getRequestUser(request);
  if (!user) return Response.json({ error: `A token is missing (${cliCommand("login")} or KITS_TOKEN)` }, { status: 401 });
  const org = await getOrg((await params).org);
  if (!org || !(await roleIn(org.id, user.id))) return Response.json({ error: "Organization not found" }, { status: 404 });
  return Response.json({ org: org.slug, policy: org.policy });
}
