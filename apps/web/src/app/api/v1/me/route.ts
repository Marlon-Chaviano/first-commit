import { getRequestUser } from "@/server/session";

/** GET /api/v1/me — who a token or session belongs to (`create-first-commit login`, and the header's account menu). */
export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  return Response.json({ handle: user.handle, name: user.name, role: user.role, image: user.image ?? null });
}
