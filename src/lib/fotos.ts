"use client";

import { crearClienteNavegador } from "@/lib/supabase/navegador";

/** Fotos por incidencia y tamano maximo de cada una (como el bucket). */
export const MAX_FOTOS_INCIDENCIA = 8;
export const TAMANO_MAXIMO_FOTO = 10 * 1024 * 1024;

const LADO_MAXIMO = 1600;

/**
 * Reduce la foto a 1600 px por el lado mayor y la pasa a JPEG, para que las
 * fotos del movil no pesen varios megas. Si el navegador no puede leerla, se
 * devuelve tal cual (el almacenamiento rechaza lo que no sea JPEG, PNG o WebP).
 */
async function reducirFoto(archivo: File): Promise<Blob> {
  try {
    const imagen = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(imagen.width * escala);
    lienzo.height = Math.round(imagen.height * escala);
    lienzo.getContext("2d")?.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    imagen.close();
    const blob = await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, "image/jpeg", 0.82));
    return blob ?? archivo;
  } catch {
    return archivo;
  }
}

/** Sube las fotos al almacenamiento y devuelve sus rutas. */
export async function subirFotosIncidencia(
  comunidadId: string,
  incidenciaId: string,
  archivos: File[],
): Promise<{ rutas: string[]; fallidas: number }> {
  const supabase = crearClienteNavegador();
  const rutas: string[] = [];
  let fallidas = 0;

  for (const archivo of archivos) {
    const blob = await reducirFoto(archivo);
    const tipo = blob.type || archivo.type;
    if (!["image/jpeg", "image/png", "image/webp"].includes(tipo) || blob.size > TAMANO_MAXIMO_FOTO) {
      fallidas += 1;
      continue;
    }
    const extension = tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "jpg";
    const ruta = `${comunidadId}/${incidenciaId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("incidencias").upload(ruta, blob, { contentType: tipo, upsert: false });
    if (error) fallidas += 1;
    else rutas.push(ruta);
  }

  return { rutas, fallidas };
}
