import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Esta app es dinamica y con sesion: desactivamos Cache Components
  // para que las rutas protegidas se rendericen siempre en el servidor.
  cacheComponents: false,
  partialPrefetching: false,
  experimental: {
    // Reutiliza el contenido ya visitado durante 30 s al navegar entre
    // modulos. Las acciones de servidor llaman a revalidatePath, asi que
    // los cambios se siguen viendo al instante.
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // El navegador debe comprobar siempre si hay una version nueva del SW.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
