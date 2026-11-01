"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
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
  const { usuario, miembro, comunidad } = await requerirContexto();

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

export async function cambiarEstadoIncidencia(id: string, estado: string) {
  const estados = ["abierta", "en_curso", "resuelta", "cerrada"] as const;
  if (!estados.includes(estado as (typeof estados)[number])) return;

  const { miembro } = await requerirContexto();
  const supabase = await crearClienteServidor();

  await supabase
    .from("incidencias")
    .update({
      estado: estado as (typeof estados)[number],
      resuelto_en: estado === "resuelta" || estado === "cerrada" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("comunidad_id", miembro.comunidad_id);

  revalidatePath("/incidencias");
  revalidatePath("/panel");
}
