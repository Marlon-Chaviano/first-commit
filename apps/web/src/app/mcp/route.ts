import { createKitsServer, type KitsSource } from "@kits/mcp";
import { resolveRecommendation } from "@kits/schema";
import { createMcpHandler } from "@modelcontextprotocol/server";

import { clientIp } from "@/server/rate-limit";
import { normalizeDescription, recommend, RECOMMEND_LIMIT_MESSAGE, recommendLimit } from "@/server/recommend";
import { getAllEntries, getCatalog, getKit } from "@/server/registry";

/** The registry for one request: `recommend` counts against the caller's daily limit, like the website. */
const sourceFor = (ip: string): KitsSource => ({
  entries: getAllEntries,
  catalog: getCatalog,
  kit: async (ref) => {
    const kit = await getKit(ref);
    if (!kit) throw new Error(`The "${ref}" kit doesn't exist`);
    return kit;
  },
  recommend: async (description) => {
    if (!(await recommendLimit.allow(ip))) throw new Error(RECOMMEND_LIMIT_MESSAGE);
    const rec = await recommend(normalizeDescription(description));
    const kit = (await getKit(rec.kit))!;
    // The cached answer is already valid; rebuild the full selections for the install command.
    return resolveRecommendation(kit, rec, rec.source);
  },
});

/**
 * Remote MCP server (streamable HTTP, stateless): search, recommend and plan.
 * It never runs commands; for that, agents use the local one (`create-first-commit mcp`).
 * One server per request, so each one knows the caller's IP.
 */
const serve = (request: Request) => createMcpHandler(() => createKitsServer({ source: sourceFor(clientIp(request)), version: "1.0.0", cwd: "." })).fetch(request);
export { serve as DELETE, serve as GET, serve as POST };
