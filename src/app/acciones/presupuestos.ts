"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { puedeEditarFinanzas } from "@/lib/permisos";
import { cuotaMensualDe } from "@/lib/presupuestos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoMoneda } from "@/lib/utilidades";

/**
 * Presupuesto anual por partidas, su aprobacion en junta y la cuota que
 * sale de el. Solo el presidente y el administrador de plataforma.
 */

export type EstadoPresupuesto = { error?: string; ok?: boolean; mensaje?: string };

const SIN_PERMISO = {
  error: "Solo el presidente o el administrador de plataforma pueden editar el presupuesto.",
};

const ejercicio = z.coerce
  .number()
  .int("El ejercicio no es válido.")
  .min(2000, "El ejercicio no es válido.")
  .max(2100, "El ejercicio no es válido.");

const importe = z
  .string()
  .trim()
  .transform((valor) => valor.replace(/\s/g, "").replace(",", "."))
  .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/, "Escribe el importe en euros, con dos decimales como mucho."))
  .transform(Number)
  .pipe(z.number().min(0).max(100_000_000, "El importe es demasiado alto."));

async function contextoEditor() {
  const contexto = await requerirContexto();
  if (!puedeEditarFinanzas(contexto.miembro.rol, contexto.esAdminPlataforma)) return null;
  return contexto;
}

function refrescar() {
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/presupuesto");
}

function mensajeError(mensaje: string | undefined, porDefecto: string) {
  if (mensaje?.includes("aprobado")) {
    return "El presupuesto ya está aprobado. Vuélvelo a borrador para cambiarlo.";
  }
  return porDefecto;
}

// ------------------------------------------------------------
// Crear el presupuesto de un ejercicio
// ------------------------------------------------------------
const esquemaCrear = z.object({
  ejercicio,
  origen: z.enum(["vacio", "copiar", "reales"]),
});

export async function crearPresupuesto(
  _estado: EstadoPresupuesto,
  datos: FormData,
): Promise<EstadoPresupuesto> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;

  const resultado = esquemaCrear.safeParse({
    ejercicio: datos.get("ejercicio"),
    origen: datos.get("origen") || "vacio",
  });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const { ejercicio: anio, origen } = resultado.data;
  const comunidadId = contexto.comunidad.id;
  const supabase = await crearClienteServidor();

  // Partidas de partida, segun lo elegido
  let partidas: {
    concepto: string;
    tipo: "gasto" | "ingreso";
    categoria_id: string | null;
    importe: number;
  }[] = [];

  if (origen === "copiar") {
    const { data: anterior } = await supabase
      .from("presupuestos")
      .select("id, partidas_presupuesto(concepto, tipo, categoria_id, importe)")
      .eq("comunidad_id", comunidadId)
      .eq("ejercicio", anio - 1)
      .maybeSingle();
    if (!anterior) return { error: `No hay presupuesto de ${anio - 1} para copiar.` };
    partidas = anterior.partidas_presupuesto.map((partida) => ({
      concepto: partida.concepto,
      tipo: partida.tipo,
      categoria_id: partida.categoria_id,
      importe: Number(partida.importe),
    }));
  }

  if (origen === "reales") {
    const [{ data: gastos }, { data: categorias }] = await Promise.all([
      supabase
        .from("gastos")
        .select("total, categoria_id")
        .eq("comunidad_id", comunidadId)
        .gte("fecha", `${anio - 1}-01-01`)
        .lte("fecha", `${anio - 1}-12-31`),
      supabase.from("categorias_gasto").select("id, nombre").eq("comunidad_id", comunidadId),
    ]);
    const nombres = new Map((categorias ?? []).map((categoria) => [categoria.id, categoria.nombre]));
    const porCategoria = new Map<string, number>();
    for (const gasto of gastos ?? []) {
      const clave = gasto.categoria_id ?? "";
      porCategoria.set(clave, (porCategoria.get(clave) ?? 0) + Math.round(Number(gasto.total) * 100));
    }
    if (porCategoria.size === 0) return { error: `No hay gastos registrados en ${anio - 1}.` };
    partidas = [...porCategoria.entries()].map(([categoriaId, centimos]) => ({
      concepto: (categoriaId && nombres.get(categoriaId)) || "Otros gastos",
      tipo: "gasto",
      categoria_id: categoriaId || null,
      importe: centimos / 100,
    }));
  }

  const { data: presupuesto, error } = await supabase
    .from("presupuestos")
    .insert({ comunidad_id: comunidadId, ejercicio: anio })
    .select("id")
    .single();
  if (error || !presupuesto) {
    return {
      error:
        error?.code === "23505"
          ? `Ya existe el presupuesto de ${anio}.`
          : "No se pudo crear el presupuesto.",
    };
  }

  if (partidas.length > 0) {
    const { error: errorPartidas } = await supabase
      .from("partidas_presupuesto")
      .insert(partidas.map((partida) => ({ ...partida, presupuesto_id: presupuesto.id })));
    if (errorPartidas) return { error: "Se creó el presupuesto, pero no se pudieron copiar las partidas." };
  }

  refrescar();
  return { ok: true };
}

// ------------------------------------------------------------
// Partidas
// ------------------------------------------------------------
const esquemaPartida = z.object({
  presupuestoId: z.string().uuid("Presupuesto no válido."),
  id: z.string().uuid().optional(),
  concepto: z.string().trim().min(2, "Escribe el concepto.").max(140, "El concepto es demasiado largo."),
  tipo: z.enum(["gasto", "ingreso"]),
  categoriaId: z.string().uuid().optional().or(z.literal("")),
  importe,
});

async function presupuestoDeLaComunidad(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  id: string,
  comunidadId: string,
) {
  const { data } = await supabase
    .from("presupuestos")
    .select("id, estado, ejercicio, total_gastos, total_ingresos")
    .eq("id", id)
    .eq("comunidad_id", comunidadId)
    .maybeSingle();
  return data;
}

export async function guardarPartida(
  _estado: EstadoPresupuesto,
  datos: FormData,
): Promise<EstadoPresupuesto> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;

  const resultado = esquemaPartida.safeParse({
    presupuestoId: datos.get("presupuestoId"),
    id: datos.get("id") || undefined,
    concepto: datos.get("concepto"),
    tipo: datos.get("tipo") || "gasto",
    categoriaId: datos.get("categoriaId") || "",
    importe: datos.get("importe"),
  });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const supabase = await crearClienteServidor();
  const presupuesto = await presupuestoDeLaComunidad(
    supabase,
    resultado.data.presupuestoId,
    contexto.comunidad.id,
  );
  if (!presupuesto) return { error: "El presupuesto no existe." };

  const fila = {
    concepto: resultado.data.concepto,
    tipo: resultado.data.tipo,
    categoria_id: resultado.data.categoriaId || null,
    importe: resultado.data.importe,
  };

  const { error } = resultado.data.id
    ? await supabase
        .from("partidas_presupuesto")
        .update(fila)
        .eq("id", resultado.data.id)
        .eq("presupuesto_id", presupuesto.id)
    : await supabase.from("partidas_presupuesto").insert({ ...fila, presupuesto_id: presupuesto.id });

  if (error) return { error: mensajeError(error.message, "No se pudo guardar la partida.") };

  refrescar();
  return { ok: true };
}

export async function eliminarPartida(
  _estado: EstadoPresupuesto,
  datos: FormData,
): Promise<EstadoPresupuesto> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;

  const id = z.string().uuid().safeParse(datos.get("id"));
  if (!id.success) return { error: "Partida no válida." };

  const supabase = await crearClienteServidor();
  const { data: partida } = await supabase
    .from("partidas_presupuesto")
    .select("id, presupuesto_id, presupuestos!inner(comunidad_id)")
    .eq("id", id.data)
    .eq("presupuestos.comunidad_id", contexto.comunidad.id)
    .maybeSingle();
  if (!partida) return { error: "La partida no existe." };

  const { error } = await supabase.from("partidas_presupuesto").delete().eq("id", partida.id);
  if (error) return { error: mensajeError(error.message, "No se pudo quitar la partida.") };

  refrescar();
  return { ok: true };
}

// ------------------------------------------------------------
// Estado: borrador -> aprobado -> cerrado
// ------------------------------------------------------------
const esquemaEstado = z.object({
  id: z.string().uuid("Presupuesto no válido."),
  estado: z.enum(["borrador", "aprobado", "cerrado"]),
  aprobadoEn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export async function cambiarEstadoPresupuesto(
  _estado: EstadoPresupuesto,
  datos: FormData,
): Promise<EstadoPresupuesto> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;

  const resultado = esquemaEstado.safeParse({
    id: datos.get("id"),
    estado: datos.get("estado"),
    aprobadoEn: datos.get("aprobadoEn") || "",
  });
  if (!resultado.success) return { error: "Revisa los datos." };

  const supabase = await crearClienteServidor();
  const presupuesto = await presupuestoDeLaComunidad(supabase, resultado.data.id, contexto.comunidad.id);
  if (!presupuesto) return { error: "El presupuesto no existe." };

  const { estado, aprobadoEn } = resultado.data;
  if (estado === "aprobado" && Number(presupuesto.total_gastos) <= 0) {
    return { error: "Añade al menos una partida de gasto antes de aprobarlo." };
  }

  const { error } = await supabase
    .from("presupuestos")
    .update({
      estado,
      aprobado_en:
        estado === "borrador"
          ? null
          : estado === "aprobado"
            ? aprobadoEn
              ? `${aprobadoEn}T12:00:00Z`
              : new Date().toISOString()
            : undefined,
    })
    .eq("id", presupuesto.id);
  if (error) return { error: "No se pudo cambiar el estado del presupuesto." };

  refrescar();
  return { ok: true };
}

// ------------------------------------------------------------
// Usar la cuota que sale del presupuesto
// ------------------------------------------------------------
export async function aplicarCuotaPresupuesto(
  _estado: EstadoPresupuesto,
  datos: FormData,
): Promise<EstadoPresupuesto> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;

  const id = z.string().uuid().safeParse(datos.get("id"));
  if (!id.success) return { error: "Presupuesto no válido." };

  const supabase = await crearClienteServidor();
  const presupuesto = await presupuestoDeLaComunidad(supabase, id.data, contexto.comunidad.id);
  if (!presupuesto) return { error: "El presupuesto no existe." };
  if (presupuesto.estado === "borrador") {
    return { error: "Aprueba el presupuesto en junta antes de cambiar la cuota." };
  }

  const cuota = cuotaMensualDe(presupuesto);
  const { error } = await supabase
    .from("comunidades")
    .update({ cuota_mensual: cuota })
    .eq("id", contexto.comunidad.id);
  if (error) return { error: "No se pudo actualizar la cuota mensual." };

  refrescar();
  revalidatePath("/finanzas/recibos");
  return { ok: true, mensaje: `Cuota mensual actualizada a ${formatoMoneda(cuota)}.` };
}

// ------------------------------------------------------------
// Borrar un presupuesto en borrador
// ------------------------------------------------------------
export async function eliminarPresupuesto(
  _estado: EstadoPresupuesto,
  datos: FormData,
): Promise<EstadoPresupuesto> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;

  const id = z.string().uuid().safeParse(datos.get("id"));
  if (!id.success) return { error: "Presupuesto no válido." };

  const supabase = await crearClienteServidor();
  const presupuesto = await presupuestoDeLaComunidad(supabase, id.data, contexto.comunidad.id);
  if (!presupuesto) return { error: "El presupuesto no existe." };
  if (presupuesto.estado !== "borrador") {
    return { error: "Solo se puede borrar un presupuesto en borrador." };
  }

  const { error } = await supabase.from("presupuestos").delete().eq("id", presupuesto.id);
  if (error) return { error: "No se pudo borrar el presupuesto." };

  refrescar();
  return { ok: true };
}
