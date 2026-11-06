import { getKitHistory } from "@/server/accounts";
import { kitAccess, kitPlan } from "@/server/kit-access";
import { planAllows, PLANS } from "@/server/plans";
import { findCommunityVersion } from "@/server/registry";
import { getRequestUser } from "@/server/session";

/** GET /api/v1/stats/<slug> — daily installs as CSV (Pro and Equipos). */
export async function GET(request: Request, { params }: RouteContext<"/api/v1/stats/[...slug]">) {
  const slug = (await params).slug.join("/");
  const viewer = await getRequestUser(request);
  if (!viewer) return new Response("Log in first", { status: 401 });
  const kit = await findCommunityVersion(slug);
  if (!kit || !(await kitAccess(kit, viewer)).manage) return new Response("Not found", { status: 404 });
  const plan = await kitPlan(kit, viewer.id);
  if (!planAllows(plan, "csvExport")) return new Response("CSV export needs the Pro plan", { status: 402 });
  const { daily } = await getKitHistory(slug, PLANS[plan].historyDays);
  const csv = ["day,installs", ...daily.map((d) => `${d.day},${d.installs}`)].join("\n");
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${slug.replace("/", "_")}-installs.csv"` },
  });
}
