
import { startCliLogin } from "@/server/cli-login";
import { clientIp, rateLimit } from "@/server/rate-limit";

const limit = rateLimit("cli-login", 10, "1 h");

/** POST /api/v1/cli/login — starts a browser login for the CLI: `{ id, code, secret, url, interval, expiresIn }`. */
export async function POST(request: Request) {
  if (!(await limit.allow(clientIp(request)))) return Response.json({ error: "Too many login attempts, try again later" }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { device?: unknown };
  const started = await startCliLogin(typeof body.device === "string" ? body.device : "");
  if (!started) return Response.json({ error: "Login isn't available on this server" }, { status: 503 });
  return Response.json(started);
}
