import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./scripts/test/server-only.ts", import.meta.url)),
      "@/": fileURLToPath(new URL("./apps/web/src/", import.meta.url)),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/web/src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
