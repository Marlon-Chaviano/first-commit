import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { recommendHeuristic, resolveRecommendation, type Kit, type Recommendation, type ResolvedRecommendation } from "@kits/schema";
import { cacheLife } from "next/cache";
import { z } from "zod";

import { env } from "../env";
import { getIndex, getKit } from "../registry";

/**
 * Structured output for Claude. Records aren't allowed in strict schemas
 * (additionalProperties must be false), so options come as a list.
 */
const claudeAnswer = z.object({
  kit: z.string(),
  options: z.array(z.object({ option: z.string(), choices: z.array(z.string()) })),
  reasons: z.array(z.string()),
});

export type RecommendResult = Omit<ResolvedRecommendation, "selections">;

/** Lowercase, single spaces: "Una  Landing" and "una landing" share a cache entry. */
export function normalizeDescription(description: string): string {
  return description.trim().replace(/\s+/g, " ").toLowerCase().slice(0, 1000);
}

/**
 * Kit + options for a project description. Claude when ANTHROPIC_API_KEY is
 * set (one retry with the validation error), the keyword recommender
 * otherwise or when Claude fails. Always a valid combination of an official kit.
 * Cached per normalized description, so a repeated question costs nothing.
 */
export async function recommend(normalized: string): Promise<RecommendResult> {
  "use cache";
  cacheLife("days");
  const kits = (await Promise.all((await getIndex()).map((e) => getKit(e.name)))).filter((k): k is Kit => k !== null);
  const strip = ({ kit, options, reasons, source }: ResolvedRecommendation): RecommendResult => ({ kit, options, reasons, source });

  if (env.ANTHROPIC_API_KEY) {
    try {
      const fromClaude = await askClaude(normalized, kits);
      if (fromClaude) return strip(fromClaude);
    } catch (error) {
      console.error("[recommend] Claude no disponible, uso el recomendador por palabras clave", error);
    }
  }
  const rec = recommendHeuristic(normalized, kits);
  return strip(resolveRecommendation(kits.find((k) => k.name === rec.kit)!, rec, "heuristic"));
}

async function askClaude(description: string, kits: Kit[]): Promise<ResolvedRecommendation | null> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: `<description>\n${description}\n</description>` }];

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.parse({
      model: env.RECOMMEND_MODEL,
      max_tokens: 1024,
      system: systemPrompt(kits),
      messages,
      output_config: { format: zodOutputFormat(claudeAnswer) },
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return null;
    const answer = response.parsed_output;
    const kit = kits.find((k) => k.name === answer.kit);
    const rec: Recommendation = {
      kit: answer.kit,
      options: Object.fromEntries(answer.options.map((o) => [o.option, o.choices])),
      reasons: answer.reasons,
    };
    try {
      if (!kit) throw new Error(`"${answer.kit}" no es uno de los kits disponibles`);
      return resolveRecommendation(kit, rec, "claude");
    } catch (error) {
      // One retry, telling the model what was wrong.
      messages.push(
        { role: "assistant", content: JSON.stringify(answer) },
        { role: "user", content: `That combination is not valid: ${(error as Error).message}. Answer again with a valid one.` },
      );
    }
  }
  return null;
}

/** The catalog in a compact form: kit → options → choice ids (and what each requires). */
function systemPrompt(kits: Kit[]): string {
  const catalog = kits
    .map((kit) => {
      const options = kit.options
        .map((o) => {
          const choices = o.choices
            .map((c) => `${c.id}${c.requires ? ` (requires ${Object.entries(c.requires).map(([k, v]) => `${k}=${v.join("|")}`).join(", ")})` : ""}`)
            .join(", ");
          return `  - ${o.id} [${o.type}, default ${o.default.length ? [o.default].flat().join(",") : "none"}]: ${choices}`;
        })
        .join("\n");
      return `## ${kit.name}: ${kit.title}\n${kit.description}\n${options}`;
    })
    .join("\n\n");

  return `You recommend a starter kit for a software project. Given the user's description, pick the one kit that fits best and only the options the description actually calls for; everything else keeps its default. Prefer fewer libraries over more. Use only kit names, option ids and choice ids from the catalog below, and respect "requires". "select" options take exactly one choice; "multi" options take any number.

Write 1–4 short reasons in the language of the description: why this kit, and why each option you changed.

# Catalog

${catalog}`;
}
