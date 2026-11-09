import "server-only";

import { recommendHeuristic, resolveRecommendation, type Kit, type ResolvedRecommendation } from "@kits/schema";
import { cacheLife } from "next/cache";

import { env } from "../env";
import { rateLimit } from "../rate-limit";
import { getIndex, getKit } from "../registry";
import { askModel } from "./ai";

/**
 * Recommendations per IP and day, shared by the website and the remote MCP server: each new
 * description can be a paid model call, so nobody can spend the tokens by spamming searches.
 */
export const RECOMMEND_DAILY_LIMIT = 24;
export const recommendLimit = rateLimit("recommend", RECOMMEND_DAILY_LIMIT, "1 d");
export const RECOMMEND_LIMIT_MESSAGE = `You've reached today's limit of ${RECOMMEND_DAILY_LIMIT} recommendations. Try again tomorrow, or browse the kits.`;

export type RecommendResult = Omit<ResolvedRecommendation, "selections">;

/** Lowercase, single spaces: "Una  Landing" and "una landing" share a cache entry. */
export function normalizeDescription(description: string): string {
  return description.trim().replace(/\s+/g, " ").toLowerCase().slice(0, 1000);
}

/**
 * Kit + options for a project description. Grok when XAI_API_KEY is set (one retry with the
 * validation error), the keyword recommender otherwise or when Grok fails or is slow. Always a
 * valid combination of an official kit. Cached per normalized description, so a repeated
 * question costs nothing.
 */
export async function recommend(normalized: string): Promise<RecommendResult> {
  "use cache";
  cacheLife("days");
  const kits = (await Promise.all((await getIndex()).map((e) => getKit(e.name)))).filter((k): k is Kit => k !== null);
  const strip = ({ kit, options, reasons, source }: ResolvedRecommendation): RecommendResult => ({ kit, options, reasons, source });

  if (env.XAI_API_KEY) {
    try {
      const { recommendation } = await askModel(normalized, kits, { apiKey: env.XAI_API_KEY, model: env.RECOMMEND_MODEL });
      if (recommendation) return strip(recommendation);
    } catch (error) {
      console.error("[recommend] Grok unavailable, falling back to the keyword recommender", error);
    }
  }
  const rec = recommendHeuristic(normalized, kits);
  return strip(resolveRecommendation(kits.find((k) => k.name === rec.kit)!, rec, "heuristic"));
}
