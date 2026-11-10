import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

// Genera los PNG de la PWA a partir de los SVG de public/iconos.
// Uso: node scripts/generar-iconos.mjs
// sharp viene como dependencia opcional de Next (optimizacion de imagenes).

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const carpeta = path.join(raiz, "public", "iconos");

async function generar(entrada, salida, tamano) {
  await sharp(path.join(carpeta, entrada))
    .resize(tamano, tamano)
    .png({ compressionLevel: 9 })
    .toFile(path.join(carpeta, salida));

  console.log(`  ${salida} (${tamano}x${tamano})`);
}

console.log("Generando iconos de la PWA…");

await Promise.all([
  generar("icono.svg", "icon-192.png", 192),
  generar("icono.svg", "icon-512.png", 512),
  generar("icono.svg", "icon-1024.png", 1024),
  generar("icono.svg", "apple-touch-icon.png", 180),
  generar("icono-maskable.svg", "icon-maskable-512.png", 512),
]);

console.log("Listo.");
