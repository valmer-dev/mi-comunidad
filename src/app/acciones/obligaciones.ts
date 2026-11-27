"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { CATEGORIAS_OBLIGACION, type CategoriaObligacion } from "@/lib/obligaciones";
import { esAdministrador, puedeEditarFinanzas } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/** Obligaciones periodicas del calendario de la comunidad. */

export type EstadoObligacion = { error?: string; ok?: boolean; mensaje?: string };

const SIN_PERMISO = { error: "Solo la junta puede gestionar el calendario." };

async function contextoEditor() {
  const contexto = await requerirContexto();
  const puede =
    esAdministrador(contexto.permisos) ||
    puedeEditarFinanzas(contexto.miembro.rol, contexto.esAdminPlataforma);
  return puede ? contexto : null;
}

const categorias = Object.keys(CATEGORIAS_OBLIGACION) as [CategoriaObligacion, ...CategoriaObligacion[]];

const esquema = z.object({
  titulo: z.string().trim().min(2, "Escribe qué hay que hacer.").max(120, "El título es demasiado largo."),
  descripcion: z
    .string()
    .trim()
    .max(1000, "La descripción es demasiado larga.")
    .optional()
    .transform((v) => v || null),
  categoria: z.enum(categorias),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha."),
  cadaMeses: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(1).max(240).nullable()),
  avisoDias: z.coerce.number().int().min(0).max(365),
  proveedorId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
});

export async function crearObligacion(_estado: EstadoObligacion, datos: FormData): Promise<EstadoObligacion> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;

  const resultado = esquema.safeParse({
    titulo: datos.get("titulo"),
    descripcion: datos.get("descripcion") ?? undefined,
    categoria: datos.get("categoria"),
    fecha: datos.get("fecha"),
    cadaMeses: datos.get("cadaMeses") ?? undefined,
    avisoDias: datos.get("avisoDias") || 30,
    proveedorId: datos.get("proveedorId") ?? undefined,
  });
  if (!resultado.success) return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  const d = resultado.data;

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("obligaciones").insert({
    comunidad_id: contexto.comunidad.id,
    titulo: d.titulo,
    descripcion: d.descripcion,
    categoria: d.categoria,
    fecha: d.fecha,
    cada_meses: d.cadaMeses,
    aviso_dias: d.avisoDias,
    proveedor_id: d.proveedorId ?? null,
    creado_por: contexto.usuario.id,
  });
  if (error) {
    if (error.code === "22023") return { error: `${error.message}.` };
    return { error: "No se pudo guardar. Inténtalo de nuevo." };
  }

  revalidatePath("/calendario");
  return { ok: true, mensaje: "Añadido al calendario." };
}

export async function completarObligacion(_estado: EstadoObligacion, datos: FormData): Promise<EstadoObligacion> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;
  const id = z.uuid().safeParse(datos.get("id"));
  if (!id.success) return { error: "No válido." };

  const supabase = await crearClienteServidor();
  const { data: siguiente, error } = await supabase.rpc("completar_obligacion", { p_id: id.data });
  if (error) return { error: "No se pudo marcar como hecho." };

  revalidatePath("/calendario");
  return {
    ok: true,
    mensaje: siguiente
      ? `Hecho. La próxima vez es el ${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${siguiente}T00:00:00Z`))}.`
      : "Hecho.",
  };
}

export async function eliminarObligacion(_estado: EstadoObligacion, datos: FormData): Promise<EstadoObligacion> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;
  const id = z.uuid().safeParse(datos.get("id"));
  if (!id.success) return { error: "No válido." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("obligaciones")
    .delete()
    .eq("id", id.data)
    .eq("comunidad_id", contexto.comunidad.id);
  if (error) return { error: "No se pudo eliminar." };

  revalidatePath("/calendario");
  return { ok: true };
}
