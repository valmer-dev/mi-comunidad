"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { puedeEditarFinanzas } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const esquema = z.object({
  concepto: z.string().trim().min(3, "Describe el gasto."),
  fecha: z.string().min(1, "Indica la fecha."),
  importe: z.coerce.number().positive("El importe debe ser mayor que cero."),
  categoriaId: z.string().uuid().optional().or(z.literal("")),
  proveedorId: z.uuid().optional().or(z.literal("")),
  facturaDocumentoId: z.uuid().optional().or(z.literal("")),
});

export type EstadoGasto = { error?: string; ok?: boolean };

export async function crearGasto(
  _estado: EstadoGasto,
  datos: FormData,
): Promise<EstadoGasto> {
  const { usuario, permisos, comunidad } = await requerirContexto();
  if (!puedeEditarFinanzas(permisos)) {
    return {
      error: "No tienes permiso para registrar gastos.",
    };
  }

  const resultado = esquema.safeParse({
    concepto: datos.get("concepto"),
    fecha: datos.get("fecha"),
    importe: datos.get("importe"),
    categoriaId: datos.get("categoriaId") || "",
    proveedorId: datos.get("proveedorId") || "",
    facturaDocumentoId: datos.get("facturaDocumentoId") || "",
  });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("gastos").insert({
    comunidad_id: comunidad.id,
    concepto: resultado.data.concepto,
    fecha: resultado.data.fecha,
    base_imponible: resultado.data.importe,
    iva: 0,
    total: resultado.data.importe,
    categoria_id: resultado.data.categoriaId || null,
    proveedor_id: resultado.data.proveedorId || null,
    factura_documento_id: resultado.data.facturaDocumentoId || null,
    creado_por: usuario.id,
  });

  if (error) {
    if (error.code === "22023") return { error: `${error.message}.` };
    return { error: "No se pudo registrar el gasto." };
  }

  revalidatePath("/finanzas");
  revalidatePath("/servicios");
  revalidatePath("/panel");
  return { ok: true };
}

const esquemaCuota = z.object({
  cuota: z.coerce.number().min(0, "La cuota no puede ser negativa."),
});

export type EstadoCuota = { error?: string; ok?: boolean };

export async function actualizarCuotaMensual(
  _estado: EstadoCuota,
  datos: FormData,
): Promise<EstadoCuota> {
  const { permisos, comunidad } = await requerirContexto();
  if (!puedeEditarFinanzas(permisos)) {
    return {
      error: "No tienes permiso para editar la cuota.",
    };
  }

  const resultado = esquemaCuota.safeParse({ cuota: datos.get("cuota") });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa la cuota." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("comunidades")
    .update({ cuota_mensual: resultado.data.cuota })
    .eq("id", comunidad.id);

  if (error) return { error: "No se pudo guardar la cuota mensual." };

  revalidatePath("/finanzas");
  return { ok: true };
}
