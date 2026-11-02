import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Esta app es dinamica y con sesion: desactivamos Cache Components
  // para que las rutas protegidas se rendericen siempre en el servidor.
  cacheComponents: false,
  partialPrefetching: false,
  experimental: {
    // Las subidas de PDF van por Server Actions: hay que ampliar el limite
    // por defecto de 1 MB (25 MB + margen para el multipart).
    serverActions: {
      bodySizeLimit: "26mb",
    },
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
};

export default nextConfig;
