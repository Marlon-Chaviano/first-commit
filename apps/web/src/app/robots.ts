import { BRAND } from "@kits/schema";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    // Account pages and the API aren't content.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/account", "/admin", "/login", "/publish", "/mcp"] },
    sitemap: `${BRAND.siteUrl}/sitemap.xml`,
  };
}
