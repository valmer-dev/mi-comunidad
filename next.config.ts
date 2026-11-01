import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Esta app es dinamica y con sesion: desactivamos Cache Components
  // para que las rutas protegidas se rendericen siempre en el servidor.
  cacheComponents: false,
  partialPrefetching: false,
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
