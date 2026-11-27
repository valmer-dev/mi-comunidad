"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { puedeEditarFinanzas } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/**
 * Otros ingresos, saldo inicial de la cuenta y fondo de reserva. Igual que
 * los gastos, solo el presidente y el administrador de plataforma.
 */

export type EstadoTesoreria = { error?: string; ok?: boolean };

const SIN_PERMISO = {
  error: "No tienes permiso para editar las finanzas.",
};

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indica la fecha.");

/** Euros con coma o punto y como mucho dos decimales. */
function euros(mensaje: string, { permitirCero = false } = {}) {
  return z
    .string()
    .trim()
    .transform((valor) => valor.replace(/\s/g, "").replace(",", "."))
    .pipe(z.string().regex(/^-?\d+(\.\d{1,2})?$/, mensaje))
    .transform(Number)
    .refine((valor) => (permitirCero ? valor >= 0 : valor > 0), mensaje)
    .refine((valor) => valor < 100_000_000, "El importe es demasiado alto.");
}

async function contextoEditor() {
  const contexto = await requerirContexto();
  if (!puedeEditarFinanzas(contexto.permisos)) return null;
  return contexto;
}

function refrescar() {
  revalidatePath("/finanzas");
  revalidatePath("/panel");
}

// ------------------------------------------------------------
// Otros ingresos
// ------------------------------------------------------------
const esquemaIngreso = z.object({
  concepto: z.string().trim().min(3, "Describe el ingreso.").max(140, "El concepto es demasiado largo."),
  fecha,
  importe: euros("El importe debe ser mayor que cero, con dos decimales como mucho."),
});

export async function crearIngreso(
  _estado: EstadoTesoreria,
  datos: FormData,
): Promise<EstadoTesoreria> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;

  const resultado = esquemaIngreso.safeParse({
    concepto: datos.get("concepto"),
    fecha: datos.get("fecha"),
    importe: datos.get("importe"),
  });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("ingresos").insert({
    comunidad_id: contexto.comunidad.id,
    concepto: resultado.data.concepto,
    fecha: resultado.data.fecha,
    importe: resultado.data.importe,
    creado_por: contexto.usuario.id,
  });
  if (error) return { error: "No se pudo registrar el ingreso." };

  refrescar();
  return { ok: true };
}

export async function eliminarIngreso(
  _estado: EstadoTesoreria,
  datos: FormData,
): Promise<EstadoTesoreria> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;

  const id = z.string().uuid().safeParse(datos.get("id"));
  if (!id.success) return { error: "Ingreso no válido." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("ingresos")
    .delete()
    .eq("id", id.data)
    .eq("comunidad_id", contexto.comunidad.id);
  if (error) return { error: "No se pudo eliminar el ingreso." };

  refrescar();
  return { ok: true };
}

// ------------------------------------------------------------
// Saldo inicial de la cuenta
// ------------------------------------------------------------
const esquemaSaldo = z.object({
  saldo: z
    .string()
    .trim()
    .transform((valor) => valor.replace(/\s/g, "").replace(",", "."))
    .pipe(z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Escribe el saldo en euros, con dos decimales como mucho."))
    .transform(Number),
  fecha,
});

export async function guardarSaldoInicial(
  _estado: EstadoTesoreria,
  datos: FormData,
): Promise<EstadoTesoreria> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;

  const resultado = esquemaSaldo.safeParse({
    saldo: datos.get("saldo"),
    fecha: datos.get("fecha"),
  });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("comunidades")
    .update({
      saldo_inicial: resultado.data.saldo,
      saldo_inicial_fecha: resultado.data.fecha,
    })
    .eq("id", contexto.comunidad.id);
  if (error) return { error: "No se pudo guardar el saldo." };

  refrescar();
  return { ok: true };
}

// ------------------------------------------------------------
// Fondo de reserva
// ------------------------------------------------------------
const esquemaFondo = z.object({
  tipo: z.enum(["dotacion", "disposicion"], "Elige si aportas o retiras."),
  concepto: z.string().trim().min(3, "Describe el movimiento.").max(140, "El concepto es demasiado largo."),
  fecha,
  importe: euros("El importe debe ser mayor que cero, con dos decimales como mucho."),
});

export async function crearMovimientoFondo(
  _estado: EstadoTesoreria,
  datos: FormData,
): Promise<EstadoTesoreria> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;

  const resultado = esquemaFondo.safeParse({
    tipo: datos.get("tipo"),
    concepto: datos.get("concepto"),
    fecha: datos.get("fecha"),
    importe: datos.get("importe"),
  });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("movimientos_fondo").insert({
    comunidad_id: contexto.comunidad.id,
    tipo: resultado.data.tipo,
    concepto: resultado.data.concepto,
    fecha: resultado.data.fecha,
    importe: resultado.data.importe,
    creado_por: contexto.usuario.id,
  });
  if (error) {
    if (error.message.includes("negativo")) {
      return { error: "No hay tanto dinero en el fondo de reserva." };
    }
    return { error: "No se pudo guardar el movimiento." };
  }

  refrescar();
  return { ok: true };
}

export async function eliminarMovimientoFondo(
  _estado: EstadoTesoreria,
  datos: FormData,
): Promise<EstadoTesoreria> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;

  const id = z.string().uuid().safeParse(datos.get("id"));
  if (!id.success) return { error: "Movimiento no válido." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("movimientos_fondo")
    .delete()
    .eq("id", id.data)
    .eq("comunidad_id", contexto.comunidad.id);
  if (error) {
    if (error.message.includes("negativo")) {
      return { error: "Si lo borras, el fondo quedaría en negativo." };
    }
    return { error: "No se pudo eliminar el movimiento." };
  }

  refrescar();
  return { ok: true };
}
