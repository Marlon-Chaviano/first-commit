import { getKitHistory } from "@/server/accounts";
import { userPlan } from "@/server/billing";
import { getOrgById, roleIn } from "@/server/orgs";
import { effectivePlan, planAllows, PLANS } from "@/server/plans";
import { billingEnabled } from "@/server/stripe";
import { findCommunityVersion } from "@/server/registry";
import { getRequestUser, isAdmin } from "@/server/session";

/** GET /api/v1/stats/<slug> — daily installs as CSV (Pro and Equipos). */
export async function GET(request: Request, { params }: RouteContext<"/api/v1/stats/[...slug]">) {
  const slug = (await params).slug.join("/");
  const viewer = await getRequestUser(request);
  if (!viewer) return new Response("Log in first", { status: 401 });
  const kit = await findCommunityVersion(slug);
  if (!kit) return new Response("No encontrado", { status: 404 });
  const orgAdmin = kit.orgId ? ["owner", "admin"].includes((await roleIn(kit.orgId, viewer.id)) ?? "") : false;
  if (kit.ownerId !== viewer.id && !orgAdmin && !isAdmin(viewer)) return new Response("No encontrado", { status: 404 });

  const plan = effectivePlan(kit.orgId ? (await getOrgById(kit.orgId))?.plan : await userPlan(kit.ownerId ?? viewer.id), billingEnabled);
  if (!planAllows(plan, "csvExport")) return new Response("CSV export needs the Pro plan", { status: 402 });
  const { daily } = await getKitHistory(slug, PLANS[plan].historyDays);
  const csv = ["day,installs", ...daily.map((d) => `${d.day},${d.installs}`)].join("\n");
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${slug.replace("/", "_")}-installs.csv"` },
  });
}
