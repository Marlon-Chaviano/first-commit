import { isAuthorizedJob } from "@/server/jobs/auth";
import { sendChangelogNotifications } from "@/server/newsletter-delivery";

export const maxDuration = 300;

/**
 * Publication emails. POST: successful production deployment, or QStash retry.
 * GET: manual run with `Authorization: Bearer <CRON_SECRET>`.
 */
async function handle(request: Request) {
  const body = request.method === "POST" ? await request.text() : "";
  if (!(await isAuthorizedJob(request, body))) return new Response(null, { status: 401 });
  const expectedCommit = request.headers.get("x-deployment-commit");
  if (expectedCommit && expectedCommit !== process.env.VERCEL_GIT_COMMIT_SHA) {
    return Response.json({ status: "pending", reason: "deployment not active yet" }, { status: 409 });
  }
  const result = await sendChangelogNotifications();
  return Response.json(result, { status: result.reason === "no database" || result.reason === "no email provider" ? 503 : 200 });
}

export const POST = handle;
export const GET = handle;
