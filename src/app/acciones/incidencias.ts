"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador, puedeGestionarIncidencias } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const esquema = z.object({
  titulo: z.string().trim().min(3, "El título es demasiado corto."),
  descripcion: z.string().trim().min(5, "Describe el problema."),
  tipo: z.enum([
    "fontaneria",
    "electricidad",
    "ascensor",
    "limpieza",
    "obra",
    "ruido",
    "zonas_comunes",
    "otro",
  ]),
  prioridad: z.enum(["baja", "media", "alta", "urgente"]),
  ubicacion: z.string().trim().optional(),
});

export type EstadoIncidencia = { error?: string; ok?: boolean };

export async function crearIncidencia(
  _estado: EstadoIncidencia,
  datos: FormData,
): Promise<EstadoIncidencia> {
  const { usuario, comunidad } = await requerirContexto();

  const resultado = esquema.safeParse({
    titulo: datos.get("titulo"),
    descripcion: datos.get("descripcion"),
    tipo: datos.get("tipo"),
    prioridad: datos.get("prioridad"),
    ubicacion: datos.get("ubicacion") || undefined,
  });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("incidencias").insert({
    comunidad_id: comunidad.id,
    titulo: resultado.data.titulo,
    descripcion: resultado.data.descripcion,
    tipo: resultado.data.tipo,
    prioridad: resultado.data.prioridad,
    ubicacion: resultado.data.ubicacion ?? null,
    reportado_por: usuario.id,
  });

  if (error) return { error: "No se pudo registrar la incidencia." };

  revalidatePath("/incidencias");
  revalidatePath("/panel");
  return { ok: true };
}

export async function cambiarEstadoIncidencia(
  id: string,
  estado: string,
  comentario = "",
): Promise<{ error?: string; ok?: boolean }> {
  const esquemaEstado = z.object({
    id: z.string().uuid("Incidencia no válida."),
    estado: z.enum(["abierta", "en_curso", "resuelta", "cerrada"]),
    comentario: z
      .string()
      .trim()
      .max(600, "El comentario no puede superar los 600 caracteres."),
  });

  const resultado = esquemaEstado.safeParse({ id, estado, comentario });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const { usuario, comunidad, permisos } = await requerirContexto();

  if (!puedeGestionarIncidencias(permisos)) {
    return { error: "Solo la junta directiva puede cambiar el estado de una incidencia." };
  }

  const supabase = await crearClienteServidor();

  const { data: incidencia, error: errorLectura } = await supabase
    .from("incidencias")
    .select("id, estado")
    .eq("id", resultado.data.id)
    .eq("comunidad_id", comunidad.id)
    .maybeSingle();

  if (errorLectura || !incidencia) {
    return { error: "No se encontró la incidencia." };
  }

  const { estado: nuevoEstado, comentario: texto } = resultado.data;

  if (incidencia.estado !== nuevoEstado) {
    const { error } = await supabase
      .from("incidencias")
      .update({
        estado: nuevoEstado,
        resuelto_en:
          nuevoEstado === "resuelta" || nuevoEstado === "cerrada"
            ? new Date().toISOString()
            : null,
      })
      .eq("id", incidencia.id)
      .eq("comunidad_id", comunidad.id);

    if (error) {
      return { error: "No se pudo cambiar el estado. Inténtalo de nuevo." };
    }
  }

  // Cada cambio de estado queda en el seguimiento. El comentario es opcional.
  if (incidencia.estado !== nuevoEstado || texto) {
    const { error: errorSeguimiento } = await supabase
      .from("seguimientos_incidencia")
      .insert({
        incidencia_id: incidencia.id,
        autor_id: usuario.id,
        texto,
        estado_nuevo: nuevoEstado,
      });

    if (errorSeguimiento) {
      return {
        error: "El estado se cambió, pero no se pudo guardar el comentario.",
      };
    }
  }

  revalidatePath("/incidencias");
  revalidatePath("/panel");
  return { ok: true };
}

/** Elimina una incidencia y su seguimiento. */
export async function eliminarIncidencia(
  _estado: EstadoIncidencia,
  datos: FormData,
): Promise<EstadoIncidencia> {
  const { comunidad, permisos } = await requerirContexto();

  if (!esAdministrador(permisos)) {
    return { error: "Solo la junta directiva puede eliminar incidencias." };
  }

  const id = String(datos.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) {
    return { error: "Incidencia no válida." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("incidencias")
    .delete()
    .eq("id", id)
    .eq("comunidad_id", comunidad.id);

  if (error) {
    return { error: "No se pudo eliminar la incidencia. Inténtalo de nuevo." };
  }

  revalidatePath("/incidencias");
  revalidatePath("/panel");
  return { ok: true };
}
