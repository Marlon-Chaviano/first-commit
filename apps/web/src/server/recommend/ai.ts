import { FLAGSHIP_KITS, resolveRecommendation, type Kit, type Recommendation, type ResolvedRecommendation } from "@kits/schema";
import { z } from "zod";

/**
 * The model behind "Describe your project": xAI's Grok through its OpenAI-compatible Chat
 * Completions API. Pure (no server-only, no env) so scripts/recommend-eval.mts can run it too.
 */
export const XAI_URL = "https://api.x.ai/v1/chat/completions";

/** Structured output. Records aren't allowed in strict schemas, so options come as a list. */
const answerSchema = z.object({
  kit: z.string(),
  options: z.array(z.object({ option: z.string(), choices: z.array(z.string()) })),
  reasons: z.array(z.string()),
});
const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: { name: "recommendation", strict: true, schema: z.toJSONSchema(answerSchema) },
} as const;

export interface AskOptions {
  apiKey: string;
  model: string;
  /** Gives up after this long so the keyword recommender can answer instead. */
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface AskResult {
  recommendation: ResolvedRecommendation | null;
  usage: { prompt: number; cached: number; completion: number; calls: number };
}

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Kit + options for a description, always a valid combination: the answer goes through
 * resolveRecommendation, and an invalid one gets one retry that says what was wrong.
 */
export async function askModel(description: string, kits: Kit[], options: AskOptions): Promise<AskResult> {
  const usage = { prompt: 0, cached: 0, completion: 0, calls: 0 };
  // The catalog is the same for every request and comes first, so xAI's prompt cache serves it.
  const messages: Message[] = [
    { role: "system", content: systemPrompt(kits) },
    { role: "user", content: `<description>\n${description}\n</description>` },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await (options.fetch ?? fetch)(XAI_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: options.model, messages, temperature: 0, max_tokens: 600, response_format: RESPONSE_FORMAT }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    });
    if (!response.ok) throw new Error(`xAI answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const body = (await response.json()) as {
      choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
    };
    usage.calls++;
    usage.prompt += body.usage?.prompt_tokens ?? 0;
    usage.cached += body.usage?.prompt_tokens_details?.cached_tokens ?? 0;
    usage.completion += body.usage?.completion_tokens ?? 0;

    const message = body.choices?.[0]?.message;
    if (!message?.content || message.refusal) return { recommendation: null, usage };
    const answer = answerSchema.parse(JSON.parse(message.content));
    const kit = kits.find((k) => k.name === answer.kit);
    const rec: Recommendation = {
      kit: answer.kit,
      options: Object.fromEntries(answer.options.map((o) => [o.option, o.choices])),
      reasons: answer.reasons,
    };
    try {
      if (!kit) throw new Error(`"${answer.kit}" isn't one of the available kits`);
      return { recommendation: resolveRecommendation(kit, rec, "ai"), usage };
    } catch (error) {
      // One retry, telling the model what was wrong.
      messages.push(
        { role: "assistant", content: message.content },
        { role: "user", content: `That combination is not valid: ${(error as Error).message}. Answer again with a valid one.` },
      );
    }
  }
  return { recommendation: null, usage };
}

/** The catalog in a compact form: kit → options → choice ids (and what each requires). */
export function systemPrompt(kits: Kit[]): string {
  const defaults = kits
    .filter((k) => FLAGSHIP_KITS.has(k.name))
    .map((k) => `- ${k.category}: ${k.name} (${k.title})`)
    .join("\n");
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
      return `## ${kit.name}${FLAGSHIP_KITS.has(kit.name) ? " ★" : ""}: ${kit.title}\n${kit.description}\n${options}`;
    })
    .join("\n\n");

  return `You recommend a starter kit for a software project. Given the user's description, pick the one kit that fits best and only the options the description actually calls for; everything else keeps its default. Prefer fewer libraries over more. Use only kit names, option ids and choice ids from the catalog below, and respect "requires". "select" options take exactly one choice; "multi" options take any number. In "options", list only the options you change.

Pick the kit in two steps:
1. What is being built: a landing page or website, a SaaS or web app with accounts, an API or backend, a mobile app, a browser extension, a monorepo, a bot, docs…
2. Within that type, use the default kit below (marked ★ in the catalog). Pick another kit only when the description names its framework, language or platform (Astro, SvelteKit, Flutter, Kotlin, Django, Go, Python…), or a purpose that only that kit covers (a portfolio, a blog, a docs site, an AI app, a Discord bot…). "iOS and Android", a website for a business, login, a database, payments, a dashboard or an admin panel don't call for another kit: they fit the default kit and its options.

Default kit per type:
${defaults}

Write 1–4 short reasons: why this kit, and why each option you changed. Write them in the same language as the description: if the description is in Spanish, the reasons are in Spanish; if it is in English, in English.

# Catalog

${catalog}`;
}
