"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { enviarAvisosDespues } from "@/lib/correo";
import { ESTADOS_SEGURO, RESPONSABLES } from "@/lib/incidencias";
import { esAdministrador, puedeEditarFinanzas, puedeGestionarIncidencias } from "@/lib/permisos";
import { hoyISO } from "@/lib/recibos";
import { crearClienteAdmin } from "@/lib/supabase/admin";
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

export type EstadoIncidencia = { error?: string; ok?: boolean; id?: string; mensaje?: string };

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
  const { data: creada, error } = await supabase
    .from("incidencias")
    .insert({
      comunidad_id: comunidad.id,
      titulo: resultado.data.titulo,
      descripcion: resultado.data.descripcion,
      tipo: resultado.data.tipo,
      prioridad: resultado.data.prioridad,
      ubicacion: resultado.data.ubicacion ?? null,
      reportado_por: usuario.id,
    })
    .select("id")
    .single();

  if (error || !creada) return { error: "No se pudo registrar la incidencia." };

  revalidatePath("/incidencias");
  revalidatePath("/panel");
  return { ok: true, id: creada.id };
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

  enviarAvisosDespues(comunidad.id);
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

// ------------------------------------------------------------
// Fotos
// ------------------------------------------------------------
const RUTA_FOTO = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i;

/**
 * Registra las fotos que el navegador ya ha subido al almacenamiento. Las
 * politicas de la base comprueban que quien las sube registro la incidencia o
 * es de la junta.
 */
export async function registrarFotosIncidencia(
  incidenciaId: string,
  rutas: string[],
): Promise<EstadoIncidencia> {
  const { usuario, comunidad } = await requerirContexto();
  if (!z.uuid().safeParse(incidenciaId).success) return { error: "Incidencia no válida." };
  const prefijo = `${comunidad.id}/${incidenciaId}/`;
  const validas = rutas.filter((ruta) => RUTA_FOTO.test(ruta) && ruta.startsWith(prefijo)).slice(0, 8);
  if (validas.length === 0) return { error: "No hay fotos válidas." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("incidencias_fotos")
    .insert(validas.map((ruta) => ({ incidencia_id: incidenciaId, ruta, subido_por: usuario.id })));

  if (error) {
    await crearClienteAdmin().storage.from("incidencias").remove(validas);
    if (error.message.includes("8 fotos")) return { error: "Una incidencia puede tener 8 fotos como mucho." };
    return { error: "No se pudieron guardar las fotos." };
  }

  revalidatePath("/incidencias");
  return { ok: true };
}

export async function eliminarFotoIncidencia(
  _estado: EstadoIncidencia,
  datos: FormData,
): Promise<EstadoIncidencia> {
  await requerirContexto();
  const id = z.uuid().safeParse(datos.get("id"));
  if (!id.success) return { error: "Foto no válida." };

  const supabase = await crearClienteServidor();
  const { data: borrada, error } = await supabase
    .from("incidencias_fotos")
    .delete()
    .eq("id", id.data)
    .select("ruta")
    .maybeSingle();

  if (error || !borrada) return { error: "No se pudo eliminar la foto." };

  await crearClienteAdmin().storage.from("incidencias").remove([borrada.ruta]);
  revalidatePath("/incidencias");
  return { ok: true };
}

// ------------------------------------------------------------
// Gestion: proveedor, coste, quien paga y parte al seguro
// ------------------------------------------------------------
const euros = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/\s/g, "").replace(",", ".") : ""))
  .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Escribe el importe en euros, con dos decimales como mucho.")
  .transform((v) => (v ? Number(v) : null));

const vacioANull = <T extends z.ZodType>(esquema: T) =>
  esquema.optional().or(z.literal("").transform(() => undefined));

const esquemaGestion = z
  .object({
    id: z.uuid("Incidencia no válida."),
    proveedorId: vacioANull(z.uuid()),
    coste: euros,
    responsable: z.enum(Object.keys(RESPONSABLES) as [keyof typeof RESPONSABLES, ...(keyof typeof RESPONSABLES)[]]),
    fincaId: vacioANull(z.uuid()),
    seguroParte: z.string().trim().max(60, "El número de parte es demasiado largo.").optional(),
    seguroComunicadoEn: vacioANull(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha del parte no es válida.")),
    seguroEstado: vacioANull(z.enum(Object.keys(ESTADOS_SEGURO) as [keyof typeof ESTADOS_SEGURO, ...(keyof typeof ESTADOS_SEGURO)[]])),
    seguroIndemnizacion: euros,
    apuntarGasto: z.boolean(),
  })
  .refine((d) => d.responsable !== "privativo" || d.fincaId, {
    message: "Elige la vivienda que paga el arreglo privativo.",
  });

export async function guardarGestionIncidencia(
  _estado: EstadoIncidencia,
  datos: FormData,
): Promise<EstadoIncidencia> {
  const { usuario, comunidad, permisos, miembro, esAdminPlataforma } = await requerirContexto();
  if (!puedeGestionarIncidencias(permisos)) {
    return { error: "Solo la junta directiva puede gestionar las incidencias." };
  }

  const resultado = esquemaGestion.safeParse({
    id: datos.get("id"),
    proveedorId: datos.get("proveedorId") ?? undefined,
    coste: datos.get("coste") ?? undefined,
    responsable: datos.get("responsable"),
    fincaId: datos.get("fincaId") ?? undefined,
    seguroParte: datos.get("seguroParte") ?? undefined,
    seguroComunicadoEn: datos.get("seguroComunicadoEn") ?? undefined,
    seguroEstado: datos.get("seguroEstado") ?? undefined,
    seguroIndemnizacion: datos.get("seguroIndemnizacion") ?? undefined,
    apuntarGasto: datos.get("apuntarGasto") === "on",
  });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const d = resultado.data;

  const supabase = await crearClienteServidor();
  const { data: actual } = await supabase
    .from("incidencias")
    .select("id, titulo, estado, proveedor_id, gasto_id")
    .eq("id", d.id)
    .eq("comunidad_id", comunidad.id)
    .maybeSingle();
  if (!actual) return { error: "No se encontró la incidencia." };

  const conSeguro = Boolean(d.seguroParte || d.seguroComunicadoEn || d.seguroEstado);
  const { error } = await supabase
    .from("incidencias")
    .update({
      proveedor_id: d.proveedorId ?? null,
      coste: d.coste,
      responsable: d.responsable,
      finca_id: d.fincaId ?? null,
      seguro_parte: d.seguroParte || null,
      seguro_comunicado_en: d.seguroComunicadoEn ?? (conSeguro ? hoyISO() : null),
      seguro_estado: d.seguroEstado ?? (conSeguro ? "comunicado" : null),
      seguro_indemnizacion: d.seguroIndemnizacion,
    })
    .eq("id", actual.id)
    .eq("comunidad_id", comunidad.id);

  if (error) {
    if (error.code === "22023") return { error: `${error.message}.` };
    return { error: "No se pudo guardar. Inténtalo de nuevo." };
  }

  // Avisar a quien la registro de que ya hay alguien encargado.
  if (d.proveedorId && d.proveedorId !== actual.proveedor_id) {
    const { data: proveedor } = await supabase
      .from("proveedores")
      .select("nombre")
      .eq("id", d.proveedorId)
      .maybeSingle();
    if (proveedor) {
      await supabase.from("seguimientos_incidencia").insert({
        incidencia_id: actual.id,
        autor_id: usuario.id,
        texto: `Se ha encargado el arreglo a ${proveedor.nombre}.`,
        estado_nuevo: actual.estado,
      });
      enviarAvisosDespues(comunidad.id);
    }
  }

  let mensaje = "Guardado.";
  if (d.apuntarGasto && !actual.gasto_id) {
    if (!puedeEditarFinanzas(miembro.rol, esAdminPlataforma)) {
      mensaje = "Guardado. Para apuntar el gasto hace falta poder editar las finanzas.";
    } else if (d.responsable !== "comunidad") {
      mensaje = "Guardado. El coste no se apunta como gasto porque no lo paga la comunidad.";
    } else if (!d.coste) {
      mensaje = "Guardado. Escribe el coste para apuntarlo como gasto.";
    } else {
      const { data: gasto, error: errorGasto } = await supabase
        .from("gastos")
        .insert({
          comunidad_id: comunidad.id,
          concepto: `Incidencia: ${actual.titulo}`.slice(0, 200),
          fecha: hoyISO(),
          base_imponible: d.coste,
          iva: 0,
          total: d.coste,
          proveedor_id: d.proveedorId ?? null,
          creado_por: usuario.id,
        })
        .select("id")
        .single();
      if (errorGasto || !gasto) {
        mensaje = "Guardado, pero no se pudo apuntar el gasto.";
      } else {
        await supabase.from("incidencias").update({ gasto_id: gasto.id }).eq("id", actual.id);
        mensaje = "Guardado y apuntado en los gastos de la comunidad.";
        revalidatePath("/finanzas");
        revalidatePath("/servicios");
      }
    }
  }

  revalidatePath("/incidencias");
  return { ok: true, mensaje };
}
