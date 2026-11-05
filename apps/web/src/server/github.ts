import "server-only";

import { BRAND } from "@kits/schema";
import { cacheLife } from "next/cache";

/** Stars of the public repo, refreshed hourly (60 unauthenticated GitHub requests/hour is plenty). Null if unknown. */
export async function getRepoStars(): Promise<number | null> {
  "use cache";
  cacheLife("hours");
  try {
    const res = await fetch(`https://api.github.com/repos/${BRAND.repo}`, {
      headers: { accept: "application/vnd.github+json", "user-agent": BRAND.name },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const { stargazers_count } = (await res.json()) as { stargazers_count?: number };
    return typeof stargazers_count === "number" ? stargazers_count : null;
  } catch {
    return null;
  }
}
