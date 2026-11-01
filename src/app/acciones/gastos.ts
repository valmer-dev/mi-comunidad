"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const esquema = z.object({
  concepto: z.string().trim().min(3, "Describe el gasto."),
  fecha: z.string().min(1, "Indica la fecha."),
  importe: z.coerce.number().positive("El importe debe ser mayor que cero."),
  categoriaId: z.string().uuid().optional().or(z.literal("")),
});

export type EstadoGasto = { error?: string; ok?: boolean };

export async function crearGasto(
  _estado: EstadoGasto,
  datos: FormData,
): Promise<EstadoGasto> {
  const { usuario, miembro, comunidad } = await requerirContexto();
  if (!esAdministrador(miembro.rol)) {
    return { error: "Solo la junta directiva puede registrar gastos." };
  }

  const resultado = esquema.safeParse({
    concepto: datos.get("concepto"),
    fecha: datos.get("fecha"),
    importe: datos.get("importe"),
    categoriaId: datos.get("categoriaId") || "",
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
    creado_por: usuario.id,
  });

  if (error) return { error: "No se pudo registrar el gasto." };

  revalidatePath("/finanzas");
  revalidatePath("/panel");
  return { ok: true };
}
