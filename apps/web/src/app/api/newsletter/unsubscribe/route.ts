import { unsubscribe } from "@/server/newsletter";

/** RFC 8058 one-click unsubscribe: Gmail, Apple Mail and others POST here from the List-Unsubscribe header. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const ok = await unsubscribe(url.searchParams.get("id") ?? "", url.searchParams.get("sig") ?? "");
  return new Response(null, { status: ok ? 204 : 400 });
}
