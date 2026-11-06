"use server";

import { decideCliLogin } from "@/server/cli-login";
import { getViewer } from "@/server/session";

export type DecideState = { status: "idle" | "approved" | "denied" | "invalid" };

/** The button on /cli/login: approve (or deny) the code shown in the terminal. */
export async function decideCliLoginAction(_prev: DecideState, form: FormData): Promise<DecideState> {
  const viewer = await getViewer();
  if (!viewer) return { status: "invalid" };
  const approve = form.get("decision") === "approve";
  const ok = await decideCliLogin(String(form.get("code") ?? ""), viewer.id, approve);
  return { status: ok ? (approve ? "approved" : "denied") : "invalid" };
}
