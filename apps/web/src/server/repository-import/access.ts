import "server-only";

import { hasGithubAccount } from "../accounts";
import { githubLogin } from "../env";
import type { TokenUser } from "../tokens";

export async function importAccess(viewer: TokenUser | null) {
  if (!viewer) return "guest";
  if (await hasGithubAccount(viewer.id)) return "connected";
  return githubLogin ? "link" : "unconfigured";
}
export type ImportAccess = Awaited<ReturnType<typeof importAccess>>;
