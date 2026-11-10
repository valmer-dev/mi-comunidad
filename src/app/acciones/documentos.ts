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

const esquemaDocumento = z.object({
  ruta: z.string().trim().min(1),
  nombre: z.string().trim().max(140).optional(),
  descripcion: z.string().trim().max(500).optional(),
  categoria: z.string().trim(),
});

export type DatosDocumento = z.infer<typeof esquemaDocumento>;

export type EstadoDocumento = { error?: string; ok?: boolean; mensaje?: string };

/**
 * Registra en la base de datos un PDF que el navegador ya ha subido
 * directamente a Supabase Storage. La subida directa evita el limite de
 * tamano de las Server Actions de Vercel.
 */
export async function registrarDocumento(
  datos: DatosDocumento,
): Promise<EstadoDocumento> {
  const { usuario, comunidad, permisos } = await requerirContexto();

  if (!puedeGestionarDocumentos(permisos)) {
    return { error: "No tienes permiso para subir documentos." };
  }

  const resultado = esquemaDocumento.safeParse(datos);
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const { ruta } = resultado.data;
  if (!esCategoriaDocumento(resultado.data.categoria)) {
    return { error: "Elige una categoría válida." };
  }

  const prefijo = `${comunidad.id}/`;
  const nombreArchivo = ruta.slice(prefijo.length);
  const rutaValida =
    ruta.startsWith(prefijo) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i.test(
      nombreArchivo,
    );

  if (!rutaValida) {
    return { error: "El archivo no es válido." };
  }

  const admin = crearClienteAdmin();
  const { data: info, error: errorInfo } = await admin.storage
    .from("documentos")
    .info(ruta);

  if (errorInfo || !info) {
    return { error: "No se encontró el PDF subido. Inténtalo de nuevo." };
  }

  if (
    info.contentType !== "application/pdf" ||
    !info.size ||
    info.size > TAMANO_MAXIMO_DOCUMENTO
  ) {
    await admin.storage.from("documentos").remove([ruta]);
    return { error: "El PDF no es válido o supera el tamaño máximo." };
  }

  const nombre =
    resultado.data.nombre || info.name.replace(/\.pdf$/i, "").trim() || "Documento";

  const supabase = await crearClienteServidor();
  const { error: errorFila } = await supabase.from("documentos").insert({
    comunidad_id: comunidad.id,
    nombre,
    descripcion: resultado.data.descripcion || null,
    carpeta: resultado.data.categoria,
    ruta_almacenamiento: ruta,
    tipo_mime: "application/pdf",
    tamano_bytes: info.size,
    subido_por: usuario.id,
  });

  if (errorFila) {
    await admin.storage.from("documentos").remove([ruta]);
    return { error: "No se pudo guardar el documento. Inténtalo de nuevo." };
  }

  revalidatePath("/documentos");
  return {
    ok: true,
    mensaje: `«${nombre}» añadido a ${resultado.data.categoria}.`,
  };
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
