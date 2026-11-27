"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador, puedeEditarFinanzas } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/**
 * Servicios contratados por la comunidad (mantenimiento, administración,
 * limpieza...). Se guardan en la tabla `proveedores`: `categoria` es el
 * servicio y `nombre` la empresa que lo presta.
 *
 * Los servicios los puede ver cualquier miembro. Los crean, editan y
 * eliminan quienes administran la comunidad (permiso `administra_comunidad`)
 * o editan sus finanzas. Cada ficha guarda tambien CIF, contacto, contrato
 * (fechas, importe, renovacion, preaviso y PDF) y la fecha del seguro.
 */

const telefono = z
  .string()
  .trim()
  .min(5, "Escribe un teléfono de contacto.")
  .max(30, "El teléfono es demasiado largo.")
  .refine(
    (valor) => /^[+()\d\s.-]+$/.test(valor),
    "El teléfono solo puede tener números, espacios, +, -, puntos y paréntesis.",
  )
  .refine(
    (valor) => (valor.match(/\d/g) ?? []).length >= 6,
    "El teléfono no parece válido.",
  );

const fechaOpcional = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida.")
  .optional()
  .or(z.literal("").transform(() => undefined));

const textoOpcional = (max: number, mensaje: string) =>
  z.string().trim().max(max, mensaje).optional().transform((v) => v || null);

const esquema = z.object({
  servicio: z
    .string()
    .trim()
    .min(3, "Escribe el servicio (por ejemplo, mantenimiento de ascensores).")
    .max(120, "El servicio no puede superar los 120 caracteres."),
  empresa: z
    .string()
    .trim()
    .min(2, "Escribe el nombre de la empresa.")
    .max(140, "El nombre de la empresa no puede superar los 140 caracteres."),
  telefono,
  cif: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v.replace(/[\s.-]/g, ""))
    .refine((v) => v === "" || /^[A-Z0-9]{8,10}$/.test(v), "El CIF o NIF no parece válido.")
    .optional()
    .transform((v) => v || null),
  personaContacto: textoOpcional(120, "El nombre de contacto es demasiado largo."),
  correo: z
    .email("El correo no parece válido.")
    .max(160)
    .optional()
    .or(z.literal("").transform(() => undefined))
    .transform((v) => v ?? null),
  contratoInicio: fechaOpcional,
  contratoFin: fechaOpcional,
  renovacionAutomatica: z.boolean(),
  preavisoDias: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int("El preaviso son días enteros.").min(0).max(365, "El preaviso no puede pasar de 365 días.").nullable()),
  importeAnual: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\s/g, "").replace(",", ".") : ""))
    .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Escribe el importe anual en euros.")
    .transform((v) => (v ? Number(v) : null)),
  seguroHasta: fechaOpcional,
  contratoDocumentoId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  notas: textoOpcional(1000, "Las notas son demasiado largas."),
}).refine(
  (d) => !d.contratoInicio || !d.contratoFin || d.contratoFin >= d.contratoInicio,
  { message: "El contrato no puede terminar antes de empezar.", path: ["contratoFin"] },
);

function leerFormulario(datos: FormData) {
  return {
    servicio: datos.get("servicio"),
    empresa: datos.get("empresa"),
    telefono: datos.get("telefono"),
    cif: datos.get("cif") ?? undefined,
    personaContacto: datos.get("personaContacto") ?? undefined,
    correo: datos.get("correo") ?? undefined,
    contratoInicio: datos.get("contratoInicio") ?? undefined,
    contratoFin: datos.get("contratoFin") ?? undefined,
    renovacionAutomatica: datos.get("renovacionAutomatica") === "on",
    preavisoDias: datos.get("preavisoDias") ?? undefined,
    importeAnual: datos.get("importeAnual") ?? undefined,
    seguroHasta: datos.get("seguroHasta") ?? undefined,
    contratoDocumentoId: datos.get("contratoDocumentoId") ?? undefined,
    notas: datos.get("notas") ?? undefined,
  };
}

function columnas(d: z.infer<typeof esquema>) {
  return {
    categoria: d.servicio,
    nombre: d.empresa,
    telefono: d.telefono,
    cif: d.cif,
    persona_contacto: d.personaContacto,
    correo: d.correo,
    contrato_inicio: d.contratoInicio ?? null,
    contrato_fin: d.contratoFin ?? null,
    renovacion_automatica: d.renovacionAutomatica,
    preaviso_dias: d.preavisoDias,
    importe_anual: d.importeAnual,
    seguro_hasta: d.seguroHasta ?? null,
    contrato_documento_id: d.contratoDocumentoId ?? null,
    notas: d.notas,
  };
}

function puedeGestionar(contexto: Awaited<ReturnType<typeof requerirContexto>>) {
  return (
    esAdministrador(contexto.permisos) ||
    puedeEditarFinanzas(contexto.permisos)
  );
}

function refrescar() {
  revalidatePath("/servicios");
  revalidatePath("/finanzas");
  revalidatePath("/panel");
}

const idServicio = z.uuid("Servicio no válido.");

export type EstadoServicio = { error?: string; ok?: boolean; mensaje?: string };

function sinPermiso(accion: string) {
  return {
    error: `Solo el Administrador Plataforma, el Presidente y el Vicepresidente pueden ${accion} servicios.`,
  };
}

export async function crearServicio(
  _estado: EstadoServicio,
  datos: FormData,
): Promise<EstadoServicio> {
  const contexto = await requerirContexto();
  const { comunidad } = contexto;

  if (!puedeGestionar(contexto)) return sinPermiso("crear");

  const resultado = esquema.safeParse(leerFormulario(datos));

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("proveedores").insert({
    comunidad_id: comunidad.id,
    ...columnas(resultado.data),
  });

  if (error) {
    if (error.code === "22023") return { error: `${error.message}.` };
    return { error: "No se pudo guardar el servicio. Inténtalo de nuevo." };
  }

  refrescar();
  return { ok: true, mensaje: "Servicio añadido." };
}

export async function actualizarServicio(
  _estado: EstadoServicio,
  datos: FormData,
): Promise<EstadoServicio> {
  const contexto = await requerirContexto();
  const { comunidad } = contexto;

  if (!puedeGestionar(contexto)) return sinPermiso("editar");

  const id = idServicio.safeParse(datos.get("id"));
  if (!id.success) return { error: "Servicio no válido." };
  const resultado = esquema.safeParse(leerFormulario(datos));

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("proveedores")
    .update(columnas(resultado.data))
    .eq("id", id.data)
    .eq("comunidad_id", comunidad.id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "22023") return { error: `${error.message}.` };
    return { error: "No se pudo guardar el servicio. Inténtalo de nuevo." };
  }

  if (!data) return { error: "No se encontró el servicio." };

  refrescar();
  return { ok: true, mensaje: "Servicio actualizado." };
}

export async function eliminarServicio(
  _estado: EstadoServicio,
  datos: FormData,
): Promise<EstadoServicio> {
  const contexto = await requerirContexto();
  const { comunidad } = contexto;

  if (!puedeGestionar(contexto)) return sinPermiso("eliminar");

  const id = String(datos.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) {
    return { error: "Servicio no válido." };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("proveedores")
    .delete()
    .eq("id", id)
    .eq("comunidad_id", comunidad.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "No se pudo eliminar el servicio. Inténtalo de nuevo." };
  }

  if (!data) return { error: "No se encontró el servicio." };

  refrescar();
  return { ok: true };
}
