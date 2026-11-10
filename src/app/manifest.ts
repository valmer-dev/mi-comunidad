import type { MetadataRoute } from "next";

/**
 * Manifest de la PWA. Next lo publica en /manifest.webmanifest y enlaza
 * automaticamente desde el <head>. Los iconos se generan con
 * `node scripts/generar-iconos.mjs` a partir de los SVG de public/iconos.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Mi Comunidad",
    short_name: "Comunidad",
    description:
      "Gestión de la comunidad de vecinos: tablón, incidencias, documentos, juntas y finanzas.",
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    background_color: "#f7f5f0",
    theme_color: "#0f766e",
    lang: "es",
    dir: "ltr",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/iconos/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/iconos/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/iconos/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Tablón", short_name: "Tablón", url: "/tablon" },
      { name: "Incidencias", short_name: "Avisos", url: "/incidencias" },
      { name: "Documentos", short_name: "Documentos", url: "/documentos" },
    ],
  };
}
