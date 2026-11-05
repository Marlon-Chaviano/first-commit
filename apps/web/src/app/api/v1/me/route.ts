import { getRequestUser } from "@/server/session";

/** GET /api/v1/me — who a token or session belongs to (used by `create-first-commit login`). */
export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 });
  return Response.json({ handle: user.handle, name: user.name, role: user.role });
}
