import { Ratelimit } from "@upstash/ratelimit";

import { startCliLogin } from "@/server/cli-login";
import { keys } from "@/server/metrics/keys";
import { isLocalRedis, redis } from "@/server/redis";

const ratelimit = redis && !isLocalRedis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 h"), prefix: `${keys.rateLimit}:cli-login` }) : null;

/** POST /api/v1/cli/login — starts a browser login for the CLI: `{ id, code, secret, url, interval, expiresIn }`. */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  try {
    if (ratelimit && !(await ratelimit.limit(ip)).success) return Response.json({ error: "Too many login attempts, try again later" }, { status: 429 });
  } catch (error) {
    console.error("[cli-login] rate limiter unavailable", error);
  }
  const body = (await request.json().catch(() => ({}))) as { device?: unknown };
  const started = await startCliLogin(typeof body.device === "string" ? body.device : "");
  if (!started) return Response.json({ error: "Login isn't available on this server" }, { status: 503 });
  return Response.json(started);
}
