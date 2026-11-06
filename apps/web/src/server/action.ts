import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { DomainError } from "./errors";
import { getViewer, isAdmin } from "./session";
import type { TokenUser } from "./tokens";

/** What every server action returns to the browser. */
export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

type Auth = "required" | "admin" | "optional";
type ViewerFor<A extends Auth> = A extends "optional" ? TokenUser | null : TokenUser;

export interface ActionOptions<A extends Auth> {
  /** "required" (default): logged in. "admin": a site admin. "optional": the body gets null when logged out. */
  auth?: A;
  /** Refreshed after the body succeeds: paths (or [path, "layout"]) and cache tags. */
  revalidate?: { paths?: (string | [string, "layout" | "page"])[]; tags?: string[] };
  /** Shown when something unexpected fails (the real error is logged). */
  failure?: string;
}

/**
 * The seam every server action goes through: resolves the viewer, runs the body, refreshes what it
 * changed, and turns any DomainError (or validation error) into `{ ok: false, error }`. Redirects and
 * notFound() pass through untouched. Bodies are plain functions of (viewer), so they read as the rule.
 */
export async function action<T, A extends Auth = "required">(options: ActionOptions<A>, body: (viewer: ViewerFor<A>) => Promise<T>): Promise<Result<T>> {
  try {
    const auth = options.auth ?? "required";
    const viewer = await getViewer();
    if (auth !== "optional" && !viewer) return { ok: false, error: "Log in first" };
    if (auth === "admin" && !isAdmin(viewer)) return { ok: false, error: "You don't have permission" };
    const data = await body(viewer as ViewerFor<A>);
    for (const path of options.revalidate?.paths ?? []) {
      if (typeof path === "string") revalidatePath(path);
      else revalidatePath(path[0], path[1]);
    }
    for (const tag of options.revalidate?.tags ?? []) revalidateTag(tag, { expire: 0 });
    return { ok: true, data };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof DomainError) return { ok: false, error: error.message };
    if (error instanceof Error && error.name === "ZodError") {
      const issue = (error as Error & { issues?: { message: string }[] }).issues?.[0];
      return { ok: false, error: issue?.message ?? "Check the values you entered" };
    }
    console.error("[action]", error);
    return { ok: false, error: options.failure ?? "Something went wrong, try again" };
  }
}
