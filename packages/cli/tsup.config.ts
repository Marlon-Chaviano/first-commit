import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  // Bundle the workspace schema (and zod) so the published package is self-contained.
  noExternal: [/^@kits\//, /^@modelcontextprotocol\//, "zod"],
  banner: { js: "#!/usr/bin/env node" },
});
