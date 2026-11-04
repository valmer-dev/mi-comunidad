"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const esquema = z.object({
  titulo: z.string().trim().min(3, "El título es demasiado corto."),
  tipo: z.enum(["ordinaria", "extraordinaria"]),
  fecha: z.string().min(1, "Indica la fecha y la hora."),
  lugar: z.string().trim().optional(),
  puntos: z.string().trim().optional(),
});

export type EstadoJunta = { error?: string; ok?: boolean };

export async function crearJunta(
  _estado: EstadoJunta,
  datos: FormData,
): Promise<EstadoJunta> {
  const { usuario, comunidad, permisos } = await requerirContexto();
  if (!esAdministrador(permisos)) {
    return { error: "Solo la junta directiva puede convocar juntas." };
  }

  const resultado = esquema.safeParse({
    titulo: datos.get("titulo"),
    tipo: datos.get("tipo"),
    fecha: datos.get("fecha"),
    lugar: datos.get("lugar") || undefined,
    puntos: datos.get("puntos") || undefined,
  });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const fecha = new Date(resultado.data.fecha);
  if (Number.isNaN(fecha.getTime())) {
    return { error: "La fecha no es válida." };
  }

  const supabase = await crearClienteServidor();

  const { data: junta, error } = await supabase
    .from("juntas")
    .insert({
      comunidad_id: comunidad.id,
      titulo: resultado.data.titulo,
      tipo: resultado.data.tipo,
      fecha_hora: fecha.toISOString(),
      lugar: resultado.data.lugar ?? null,
      estado: "convocada",
      creada_por: usuario.id,
    })
    .select("id")
    .single();

  if (error || !junta) {
    return { error: "No se pudo crear la junta." };
  }

  const lineas = (resultado.data.puntos ?? "")
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean);

  if (lineas.length > 0) {
    await supabase.from("puntos_del_dia").insert(
      lineas.map((titulo, indice) => ({
        junta_id: junta.id,
        posicion: indice + 1,
        titulo,
        tipo: "acuerdo" as const,
      })),
    );
  }

  revalidatePath("/juntas");
  revalidatePath("/panel");
  return { ok: true };
}

/** Elimina una junta y todo su contenido (puntos del día y asistencias). */
export async function eliminarJunta(
  _estado: EstadoJunta,
  datos: FormData,
): Promise<EstadoJunta> {
  const { comunidad, permisos } = await requerirContexto();

  if (!esAdministrador(permisos)) {
    return { error: "Solo la junta directiva puede eliminar juntas." };
  }

  const id = String(datos.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) {
    return { error: "Junta no válida." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("juntas")
    .delete()
    .eq("id", id)
    .eq("comunidad_id", comunidad.id);

  if (error) {
    return { error: "No se pudo eliminar la junta. Inténtalo de nuevo." };
  }

  revalidatePath("/juntas");
  revalidatePath("/panel");
  return { ok: true };
}
