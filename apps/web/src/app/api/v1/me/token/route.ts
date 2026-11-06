import { revokeTokenByValue } from "@/server/tokens";

/** DELETE /api/v1/me/token — revokes the token that makes the request (`create-first-commit logout`). */
export async function DELETE(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(kits_\S+)$/i)?.[1];
  if (!token) return Response.json({ error: "Send the token as Authorization: Bearer kits_…" }, { status: 401 });
  return new Response(null, { status: (await revokeTokenByValue(token)) ? 204 : 404 });
}
