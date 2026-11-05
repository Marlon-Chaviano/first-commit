import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CI and local audits build elsewhere so they never clobber a running server's .next.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  cacheComponents: true,
  cacheLife: {
    // Install counters: refreshed at most every 5 minutes, so page views barely touch Redis
    // (keeps the project inside Upstash's free tier).
    metrics: { stale: 300, revalidate: 300, expire: 3600 },
  },
  partialPrefetching: true,
  reactCompiler: true,
  // The shared kit schema ships as TypeScript source.
  transpilePackages: ["@kits/schema", "@kits/mcp"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
