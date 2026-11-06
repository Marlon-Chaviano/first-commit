import { createKitsServer, type KitsSource } from "@kits/mcp";
import { resolveRecommendation } from "@kits/schema";
import { createMcpHandler } from "@modelcontextprotocol/server";

import { normalizeDescription, recommend } from "@/server/recommend";
import { getAllEntries, getCatalog, getKit } from "@/server/registry";

const source: KitsSource = {
  entries: getAllEntries,
  catalog: getCatalog,
  kit: async (ref) => {
    const kit = await getKit(ref);
    if (!kit) throw new Error(`The "${ref}" kit doesn't exist`);
    return kit;
  },
  recommend: async (description) => {
    const rec = await recommend(normalizeDescription(description));
    const kit = (await getKit(rec.kit))!;
    // The cached answer is already valid; rebuild the full selections for the install command.
    return resolveRecommendation(kit, rec, rec.source);
  },
};

/**
 * Remote MCP server (streamable HTTP, stateless): search, recommend and plan.
 * It never runs commands; for that, agents use the local one (`create-first-commit mcp`).
 */
const handler = createMcpHandler(() => createKitsServer({ source, version: "1.0.0", cwd: "." }));

const serve = (request: Request) => handler.fetch(request);
export { serve as DELETE, serve as GET, serve as POST };
