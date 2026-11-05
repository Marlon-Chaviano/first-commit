import { flushEvents } from "@/server/metrics/flush";
import { isAuthorizedJob } from "@/server/jobs/auth";

/**
 * Drains the Redis event queue into Postgres.
 * POST: called by the QStash schedule (see scripts/qstash-schedule.ts).
 * GET:  manual run with `Authorization: Bearer <CRON_SECRET>`.
 */
async function handle(request: Request) {
  const body = request.method === "POST" ? await request.text() : "";
  if (!(await isAuthorizedJob(request, body))) return new Response(null, { status: 401 });
  return Response.json(await flushEvents());
}

export const POST = handle;
export const GET = handle;
