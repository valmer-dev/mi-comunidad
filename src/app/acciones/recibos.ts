"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { puedeEditarFinanzas } from "@/lib/permisos";
import { METODOS_PAGO, pendienteDe, type ReciboConPagos } from "@/lib/recibos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoMoneda } from "@/lib/utilidades";

/**
 * Recibos por vivienda: generar los de un periodo, cobrar (total o parcial),
 * marcar una devolucion del banco y anular. Solo el presidente y el
 * administrador de plataforma, igual que el resto de la parte economica.
 */

export type EstadoRecibos = { error?: string; ok?: boolean; mensaje?: string };

const SIN_PERMISO = {
  error: "Solo el presidente o el administrador de plataforma pueden gestionar los recibos.",
};

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida.");

const importe = z
  .string()
  .trim()
  .transform((valor) => valor.replace(/\s/g, "").replace(",", "."))
  .pipe(
    z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Escribe el importe en euros, con dos decimales como mucho."),
  )
  .transform(Number)
  .pipe(z.number().positive("El importe debe ser mayor que cero.").max(10_000_000, "El importe es demasiado alto."));

function refrescar(fincaId?: string) {
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/recibos");
  if (fincaId) revalidatePath(`/finanzas/recibos/${fincaId}`);
  revalidatePath("/panel");
}

async function contextoEditor() {
  const contexto = await requerirContexto();
  if (!puedeEditarFinanzas(contexto.miembro.rol, contexto.esAdminPlataforma)) return null;
  return contexto;
}

// ------------------------------------------------------------
// Generar los recibos de un periodo
// ------------------------------------------------------------
const esquemaGenerar = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/, "Elige el mes."),
  concepto: z
    .string()
    .trim()
    .min(3, "Escribe el concepto (por ejemplo, Cuota ordinaria).")
    .max(120, "El concepto no puede superar los 120 caracteres."),
  importeTotal: importe,
  venceEn: fecha.optional().or(z.literal("")),
});

export async function generarRecibos(
  _estado: EstadoRecibos,
  datos: FormData,
): Promise<EstadoRecibos> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;

  const resultado = esquemaGenerar.safeParse({
    mes: datos.get("mes"),
    concepto: datos.get("concepto"),
    importeTotal: datos.get("importeTotal"),
    venceEn: datos.get("venceEn") || "",
  });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const { mes, concepto, importeTotal, venceEn } = resultado.data;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("generar_recibos", {
    p_comunidad_id: contexto.comunidad.id,
    p_periodo: `${mes}-01`,
    p_concepto: concepto,
    p_importe_total: importeTotal,
    p_vence_en: venceEn || undefined,
  });

  if (error) {
    if (error.message.includes("coeficiente")) {
      return { error: "Ninguna finca tiene coeficiente. Ponlos primero en Ajustes." };
    }
    return { error: "No se pudieron generar los recibos." };
  }

  const resumen = (data ?? {}) as { creados?: number; omitidos?: number };
  refrescar();

  if (!resumen.creados) {
    return {
      ok: true,
      mensaje: "No se ha creado ningún recibo: todas las viviendas ya tenían uno con ese mes y concepto.",
    };
  }
  const omitidos = resumen.omitidos
    ? ` ${resumen.omitidos} ya lo tenían y no se han duplicado.`
    : "";
  return {
    ok: true,
    mensaje: `${resumen.creados} recibos creados por un total de ${formatoMoneda(importeTotal)}.${omitidos}`,
  };
}

// ------------------------------------------------------------
// Leer un recibo con sus pagos (para validar en el servidor)
// ------------------------------------------------------------
async function leerRecibo(id: string, comunidadId: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("recibos")
    .select("id, finca_id, periodo, concepto, importe, estado, vence_en, pagado_en, notas, pagos(id, importe, fecha, metodo, referencia)")
    .eq("id", id)
    .eq("comunidad_id", comunidadId)
    .maybeSingle();
  return { supabase, recibo: data as ReciboConPagos | null };
}

// ------------------------------------------------------------
// Registrar un cobro
// ------------------------------------------------------------
const esquemaCobro = z.object({
  id: z.string().uuid("Recibo no válido."),
  importe,
  fecha,
  metodo: z.enum(METODOS_PAGO.map((metodo) => metodo.valor) as [string, ...string[]]),
  referencia: z.string().trim().max(120, "La referencia es demasiado larga.").optional(),
});

export async function registrarCobro(
  _estado: EstadoRecibos,
  datos: FormData,
): Promise<EstadoRecibos> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;

  const resultado = esquemaCobro.safeParse({
    id: datos.get("id"),
    importe: datos.get("importe"),
    fecha: datos.get("fecha"),
    metodo: datos.get("metodo"),
    referencia: datos.get("referencia") || undefined,
  });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const { supabase, recibo } = await leerRecibo(resultado.data.id, contexto.comunidad.id);
  if (!recibo) return { error: "El recibo no existe." };
  if (recibo.estado === "anulado") return { error: "El recibo está anulado." };

  const pendiente = pendienteDe(recibo);
  if (pendiente <= 0) return { error: "Este recibo ya está cobrado." };
  if (resultado.data.importe > pendiente) {
    return { error: `Solo quedan ${formatoMoneda(pendiente)} por cobrar en este recibo.` };
  }

  const { error } = await supabase.from("pagos").insert({
    recibo_id: recibo.id,
    importe: resultado.data.importe,
    fecha: resultado.data.fecha,
    metodo: resultado.data.metodo,
    referencia: resultado.data.referencia || null,
    registrado_por: contexto.usuario.id,
  });
  if (error) return { error: "No se pudo registrar el cobro." };

  refrescar(recibo.finca_id);
  return { ok: true };
}

// ------------------------------------------------------------
// Devolucion del banco
// ------------------------------------------------------------
const esquemaDevolver = z.object({
  id: z.string().uuid("Recibo no válido."),
  nota: z.string().trim().max(300, "La nota es demasiado larga.").optional(),
});

export async function devolverRecibo(
  _estado: EstadoRecibos,
  datos: FormData,
): Promise<EstadoRecibos> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;

  const resultado = esquemaDevolver.safeParse({
    id: datos.get("id"),
    nota: datos.get("nota") || undefined,
  });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const { supabase, recibo } = await leerRecibo(resultado.data.id, contexto.comunidad.id);
  if (!recibo) return { error: "El recibo no existe." };
  if (recibo.estado === "anulado") return { error: "El recibo está anulado." };

  const { error } = await supabase.rpc("devolver_recibo", {
    p_recibo_id: recibo.id,
    p_nota: resultado.data.nota,
  });
  if (error) return { error: "No se pudo marcar la devolución." };

  refrescar(recibo.finca_id);
  return { ok: true };
}

// ------------------------------------------------------------
// Anular (por ejemplo, un recibo emitido por error)
// ------------------------------------------------------------
export async function anularRecibo(
  _estado: EstadoRecibos,
  datos: FormData,
): Promise<EstadoRecibos> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;

  const id = z.string().uuid().safeParse(datos.get("id"));
  if (!id.success) return { error: "Recibo no válido." };

  const { supabase, recibo } = await leerRecibo(id.data, contexto.comunidad.id);
  if (!recibo) return { error: "El recibo no existe." };
  if (recibo.pagos.length > 0) {
    return {
      error: "Este recibo tiene cobros. Si el banco lo devolvió, márcalo como devuelto antes de anularlo.",
    };
  }

  const { error } = await supabase
    .from("recibos")
    .update({ estado: "anulado" })
    .eq("id", recibo.id);
  if (error) return { error: "No se pudo anular el recibo." };

  refrescar(recibo.finca_id);
  return { ok: true };
}
