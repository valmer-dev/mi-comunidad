"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import {
  esCategoriaDocumento,
  TAMANO_MAXIMO_DOCUMENTO,
} from "@/lib/documentos";
import { puedeGestionarDocumentos } from "@/lib/permisos";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const esquema = z.object({
  nombre: z.string().trim().max(140).optional(),
  descripcion: z.string().trim().max(500).optional(),
  categoria: z.string().trim(),
});

export type EstadoDocumento = { error?: string; ok?: boolean; mensaje?: string };

/**
 * Sube un PDF a la categoria indicada. Solo pueden hacerlo el administrador
 * de plataforma y los roles presidente, vicepresidente y vocal.
 */
export async function subirDocumento(
  _estado: EstadoDocumento,
  datos: FormData,
): Promise<EstadoDocumento> {
  const { usuario, comunidad, permisos } = await requerirContexto();

  if (!puedeGestionarDocumentos(permisos)) {
    return { error: "No tienes permiso para subir documentos." };
  }

  const archivo = datos.get("archivo");
  if (!archivo || typeof archivo === "string" || typeof archivo.arrayBuffer !== "function") {
    return { error: "Elige un archivo PDF." };
  }

  if (archivo.size <= 0) {
    return { error: "El archivo está vacío." };
  }

  if (archivo.size > TAMANO_MAXIMO_DOCUMENTO) {
    return { error: "El PDF no puede superar los 25 MB." };
  }

  if (!archivo.name.toLowerCase().endsWith(".pdf")) {
    return { error: "Solo se admiten archivos PDF." };
  }

  const cabecera = Buffer.from(await archivo.slice(0, 5).arrayBuffer()).toString("latin1");
  if (cabecera !== "%PDF-") {
    return { error: "El archivo no es un PDF válido." };
  }

  const resultado = esquema.safeParse({
    nombre: datos.get("nombre") || undefined,
    descripcion: datos.get("descripcion") || undefined,
    categoria: datos.get("categoria"),
  });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const { categoria } = resultado.data;
  if (!esCategoriaDocumento(categoria)) {
    return { error: "Elige una categoría válida." };
  }

  const nombre =
    resultado.data.nombre || archivo.name.replace(/\.pdf$/i, "").trim() || "Documento";

  const admin = crearClienteAdmin();
  const ruta = `${comunidad.id}/${crypto.randomUUID()}.pdf`;

  const { error: errorSubida } = await admin.storage
    .from("documentos")
    .upload(ruta, archivo, { contentType: "application/pdf", upsert: false });

  if (errorSubida) {
    return { error: "No se pudo subir el PDF. Inténtalo de nuevo." };
  }

  const supabase = await crearClienteServidor();
  const { error: errorFila } = await supabase.from("documentos").insert({
    comunidad_id: comunidad.id,
    nombre,
    descripcion: resultado.data.descripcion || null,
    carpeta: categoria,
    ruta_almacenamiento: ruta,
    tipo_mime: "application/pdf",
    tamano_bytes: archivo.size,
    subido_por: usuario.id,
  });

  if (errorFila) {
    await admin.storage.from("documentos").remove([ruta]);
    return { error: "No se pudo guardar el documento. Inténtalo de nuevo." };
  }

  revalidatePath("/documentos");
  return { ok: true, mensaje: `«${nombre}» añadido a ${categoria}.` };
}

/** Elimina un documento: primero la ficha y después el PDF del almacenamiento. */
export async function eliminarDocumento(
  _estado: EstadoDocumento,
  datos: FormData,
): Promise<EstadoDocumento> {
  const { comunidad, permisos } = await requerirContexto();

  if (!puedeGestionarDocumentos(permisos)) {
    return { error: "No tienes permiso para eliminar documentos." };
  }

  const id = String(datos.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) {
    return { error: "Documento no válido." };
  }

  const supabase = await crearClienteServidor();
  const { data: documento, error: errorLectura } = await supabase
    .from("documentos")
    .select("id, ruta_almacenamiento")
    .eq("id", id)
    .eq("comunidad_id", comunidad.id)
    .maybeSingle();

  if (errorLectura || !documento) {
    return { error: "No se encontró el documento." };
  }

  const { error } = await supabase
    .from("documentos")
    .delete()
    .eq("id", documento.id)
    .eq("comunidad_id", comunidad.id);

  if (error) {
    return { error: "No se pudo eliminar el documento. Inténtalo de nuevo." };
  }

  revalidatePath("/documentos");

  if (documento.ruta_almacenamiento) {
    const admin = crearClienteAdmin();
    const { error: errorAlmacen } = await admin.storage
      .from("documentos")
      .remove([documento.ruta_almacenamiento]);

    if (errorAlmacen) {
      return {
        error: "El documento se eliminó, pero no se pudo borrar el PDF del almacenamiento.",
      };
    }
  }

  return { ok: true };
}
