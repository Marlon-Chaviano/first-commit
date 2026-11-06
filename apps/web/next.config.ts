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
  // The site moved from Spanish to English routes: old links keep working.
  async redirects() {
    const moved: [string, string][] = [
      ["/cuenta/marcas/nueva", "/account/brands/new"],
      ["/cuenta/marcas/:path*", "/account/brands/:path*"],
      ["/cuenta/kits/:path*", "/account/kits/:path*"],
      ["/cuenta", "/account"],
      ["/docs/crear-kit", "/docs/create-kit"],
      ["/docs/referencia", "/docs/reference"],
      ["/docs/bibliotecas", "/docs/libraries"],
      ["/docs/mantener", "/docs/maintain"],
      ["/docs/agentes", "/docs/agents"],
      ["/docs/marcas", "/docs/brands"],
      ["/acerca", "/about"],
      ["/contacto", "/contact"],
      ["/contenido", "/content-policy"],
      ["/privacidad", "/privacy"],
      ["/terminos", "/terms"],
      ["/entrar", "/login"],
      ["/novedades/baja", "/changelog/unsubscribe"],
      ["/novedades/confirmar", "/changelog/confirm"],
      ["/novedades/:path*", "/changelog/:path*"],
      ["/orgs/nueva", "/orgs/new"],
      ["/precios", "/pricing"],
      ["/publicar", "/publish"],
      ["/comparar/:path*", "/compare/:path*"],
      ["/stacks/lenguaje/:path*", "/stacks/language/:path*"],
    ];
    return moved.map(([source, destination]) => ({ source, destination, permanent: true }));
  },
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
