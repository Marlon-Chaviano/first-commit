import { isAuthorizedJob } from "@/server/jobs/auth";
import { sendWeeklyDigest } from "@/server/newsletter";

/**
 * Weekly digest. POST: QStash schedule (scripts/qstash-schedule.mts).
 * GET: manual run with `Authorization: Bearer <CRON_SECRET>`.
 */
async function handle(request: Request) {
  const body = request.method === "POST" ? await request.text() : "";
  if (!(await isAuthorizedJob(request, body))) return new Response(null, { status: 401 });
  return Response.json(await sendWeeklyDigest());
}

export const POST = handle;
export const GET = handle;
