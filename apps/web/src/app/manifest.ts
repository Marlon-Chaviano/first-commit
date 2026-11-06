import { BRAND } from "@kits/schema";
import type { MetadataRoute } from "next";

/** Installing the site (Android, desktop): black like the site, with the white symbol. Icons: scripts/brand-assets.sh. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: "Workspaces ready to build with your agent: one command creates the project with its stack, skills, MCP servers and rules.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
