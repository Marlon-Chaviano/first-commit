import { BRAND } from "@kits/schema";
import type { MetadataRoute } from "next";

/** Not content: account pages, the API and the MCP endpoint. */
const PRIVATE = ["/api/", "/account", "/admin", "/login", "/publish", "/mcp", "/cli/", "/changelog/confirm", "/changelog/unsubscribe"];

/**
 * AI crawlers are named on purpose: answer engines (ChatGPT, Claude, Perplexity, Gemini…) can
 * only recommend a kit they were allowed to read. They get the same rules as everyone else.
 */
const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${BRAND.siteUrl}/sitemap.xml`,
    host: BRAND.siteUrl,
  };
}
