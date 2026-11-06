import { pollCliLogin } from "@/server/cli-login";

/** POST /api/v1/cli/login/poll — `{ id, secret }` → 202 pending · 200 `{ token, handle }` · 403 denied · 410 expired. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; secret?: unknown };
  if (typeof body.id !== "string" || typeof body.secret !== "string") return Response.json({ error: "id and secret are required" }, { status: 400 });
  const result = await pollCliLogin(body.id, body.secret);
  switch (result.status) {
    case "pending":
      return Response.json(result, { status: 202 });
    case "denied":
      return Response.json(result, { status: 403 });
    case "expired":
      return Response.json(result, { status: 410 });
    case "approved":
      return Response.json({ token: result.token, handle: result.handle });
  }
}
