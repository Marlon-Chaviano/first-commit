/**
 * Measures the AI recommender against packages/schema/src/recommend.eval.json: accuracy,
 * latency and tokens (with how many came from xAI's prompt cache), per model.
 *
 *   XAI_API_KEY=… pnpm --filter web recommend:eval
 *   XAI_API_KEY=… MODELS=grok-4.20-non-reasoning,grok-4.3 pnpm --filter web recommend:eval
 *
 * Each case is one or two real API calls: a full run costs a few cents.
 */
import { readFileSync } from "node:fs";

import { loadRegistryKits } from "@kits/schema/node";

import { askModel } from "../src/server/recommend/ai";

const apiKey = process.env.XAI_API_KEY;
if (!apiKey) throw new Error("Set XAI_API_KEY");
const models = (process.env.MODELS ?? "grok-4.20-non-reasoning").split(",").map((m) => m.trim());
const kits = await loadRegistryKits(new URL("../../../registry", import.meta.url).pathname);
const cases = JSON.parse(readFileSync(new URL("../../../packages/schema/src/recommend.eval.json", import.meta.url), "utf8")) as [string, string][];

for (const model of models) {
  const rows: { ok: boolean; ms: number; prompt: number; cached: number; completion: number; got: string; want: string; description: string }[] = [];
  for (const [description, want] of cases) {
    const started = performance.now();
    try {
      const { recommendation, usage } = await askModel(description.toLowerCase(), kits, { apiKey, model, timeoutMs: 30_000 });
      const got = recommendation?.kit ?? "(none)";
      rows.push({ ok: got === want, ms: performance.now() - started, ...usage, got, want, description });
    } catch (error) {
      rows.push({ ok: false, ms: performance.now() - started, prompt: 0, cached: 0, completion: 0, got: `error: ${(error as Error).message.slice(0, 80)}`, want, description });
    }
  }
  const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
  const sum = (k: "prompt" | "cached" | "completion") => rows.reduce((t, r) => t + r[k], 0);
  console.log(`\n${model}: ${rows.filter((r) => r.ok).length}/${rows.length} correct`);
  console.log(`  latency p50 ${Math.round(ms[Math.floor(ms.length / 2)]!)} ms · p95 ${Math.round(ms[Math.floor(ms.length * 0.95)]!)} ms`);
  console.log(`  tokens per request: ${Math.round(sum("prompt") / rows.length)} in (${Math.round((sum("cached") / Math.max(1, sum("prompt"))) * 100)}% cached) · ${Math.round(sum("completion") / rows.length)} out`);
  for (const r of rows.filter((r) => !r.ok)) console.log(`  ✗ ${r.description} → ${r.got} (expected ${r.want})`);
}
