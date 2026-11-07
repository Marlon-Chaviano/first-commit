import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  // Bundle the workspace schema (and zod) so the published package is self-contained.
  noExternal: [/^@kits\//, /^@modelcontextprotocol\//, "zod"],
  define: { __CLI_VERSION__: JSON.stringify(version) },
  banner: { js: "#!/usr/bin/env node" },
});
