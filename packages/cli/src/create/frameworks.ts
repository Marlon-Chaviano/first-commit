import type { Kit } from "@kits/schema";

type Deps = Record<string, string>;

export interface FrameworkMatch {
  id: string;
  label: string;
  category: Kit["category"];
  /** Catalog frameworks, for `libraries.framework`. */
  frameworks: string[];
  /** Whether UI libraries (components, add-ons, animation) apply. */
  ui: boolean;
  base: Kit["base"];
  addCommand?: Kit["addCommand"];
  /** Packages the scaffolder already installs: not copied into the kit. */
  baseline: (string | RegExp)[];
  /** AGENTS.md headings the scaffolder writes itself, so they aren't duplicated. */
  templateHeadings?: string[];
}

const UI_FRAMEWORKS = ["react", "vue", "svelte", "solid"] as const;

/** "react" | "vue" | … from the project's dependencies, for WXT and Vite. */
function uiFramework(deps: Deps): string {
  if (deps.react) return "react";
  if (deps.vue) return "vue";
  if (deps.svelte) return "svelte";
  if (deps["solid-js"]) return "solid";
  return "vanilla";
}

const TS_TOOLING = ["typescript", /^@types\//, "eslint", /^eslint-/, /^@eslint\//, "typescript-eslint", "globals", "prettier"];

/**
 * Known scaffolders, most specific first. The base commands match the
 * official kits so a created kit starts from the same place.
 */
export function detectFramework(deps: Deps): FrameworkMatch | null {
  if (deps.next) {
    return {
      id: "nextjs",
      label: "Next.js",
      category: "web",
      frameworks: ["react", "nextjs"],
      ui: true,
      base: {
        command:
          'npx create-next-app@latest {{name}} --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-{{pm}} --disable-git --no-agent-feedback --yes',
      },
      baseline: [
        "next",
        "react",
        "react-dom",
        "tailwindcss",
        "@tailwindcss/postcss",
        "@tailwindcss/turbopack",
        "babel-plugin-react-compiler",
        ...TS_TOOLING,
      ],
    };
  }
  if (deps.expo) {
    return {
      id: "expo",
      label: "Expo",
      category: "mobile",
      frameworks: ["react-native", "expo"],
      ui: true,
      base: { command: "npx create-expo-app@latest {{name}} --template default --no-install --yes", install: "{{pm}} install" },
      addCommand: {
        dependencies: "{{pmx}} expo install {{packages}}",
        devDependencies: "{{pmx}} expo install {{packages}} -- -D",
      },
      // What `create-expo-app --template default` (SDK 58) installs.
      baseline: [
        "expo",
        "@expo/ui",
        "expo-constants",
        "expo-device",
        "expo-font",
        "expo-glass-effect",
        "expo-image",
        "expo-linking",
        "expo-router",
        "expo-splash-screen",
        "expo-status-bar",
        "expo-symbols",
        "expo-system-ui",
        "expo-web-browser",
        "react",
        "react-dom",
        "react-native",
        "react-native-gesture-handler",
        "react-native-reanimated",
        "react-native-safe-area-context",
        "react-native-screens",
        "react-native-web",
        "react-native-worklets",
        ...TS_TOOLING,
      ],
      templateHeadings: [
        "Expo has changed — do not trust your training data",
        "Commands",
        "Navigation & Routing",
        "Building with EAS",
        "Rules",
      ],
    };
  }
  if (deps.hono) {
    const runtime = deps.wrangler ? "cloudflare-workers" : deps["@hono/node-server"] ? "nodejs" : deps["@types/bun"] ? "bun" : "nodejs";
    return {
      id: `hono-${runtime}`,
      label: `Hono (${runtime})`,
      category: "api",
      frameworks: [runtime],
      ui: false,
      base: { command: `npx create-hono@latest {{name}} --template ${runtime} --pm {{pm}} --install` },
      baseline: ["hono", "@hono/node-server", "tsx", "wrangler", "@cloudflare/workers-types", ...TS_TOOLING],
    };
  }
  if (deps.wxt) {
    const fw = uiFramework(deps);
    return {
      id: `wxt-${fw}`,
      label: `WXT (${fw})`,
      category: "extension",
      frameworks: [fw],
      ui: true,
      base: { command: `npx wxt@latest init {{name}} --template ${fw} --pm {{pm}}`, install: "{{pm}} install" },
      baseline: ["wxt", /^@wxt-dev\//, "react", "react-dom", "vue", "svelte", "solid-js", ...TS_TOOLING],
    };
  }
  if (deps.vite) {
    const fw = uiFramework(deps);
    return {
      id: `vite-${fw}`,
      label: `Vite (${fw})`,
      category: "web",
      frameworks: [fw],
      ui: (UI_FRAMEWORKS as readonly string[]).includes(fw) || fw === "vanilla",
      base: { command: `npx create-vite@latest {{name}} --template ${fw}-ts`, install: "{{pm}} install" },
      baseline: ["vite", /^@vitejs\//, /^@sveltejs\//, "vite-plugin-solid", "react", "react-dom", "vue", "svelte", "solid-js", ...TS_TOOLING],
    };
  }
  return null;
}

export function isBaseline(match: FrameworkMatch, pkg: string): boolean {
  return match.baseline.some((b) => (typeof b === "string" ? b === pkg : b.test(pkg)));
}
