"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { enviarAvisosDespues } from "@/lib/correo";
import { puedeEditarFinanzas } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoMoneda } from "@/lib/utilidades";

/**
 * Derramas: gastos extraordinarios aprobados en junta que se cobran aparte de
 * la cuota, repartidos por coeficiente en uno o varios plazos.
 */

export type EstadoDerrama = { error?: string; ok?: boolean; mensaje?: string };

const SIN_PERMISO = {
  error: "Solo el presidente o el administrador pueden gestionar las derramas.",
};

const esquema = z.object({
  titulo: z
    .string()
    .trim()
    .min(2, "Escribe el título (por ejemplo, Rehabilitación de la fachada).")
    .max(80, "El título no puede superar los 80 caracteres."),
  descripcion: z.string().trim().max(1000, "La descripción es demasiado larga.").optional(),
  importeTotal: z
    .string()
    .trim()
    .transform((valor) => valor.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."))
    .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/, "Escribe el importe en euros, con dos decimales como mucho."))
    .transform(Number)
    .pipe(z.number().positive("El importe debe ser mayor que cero.").max(10_000_000, "El importe es demasiado alto.")),
  plazos: z.coerce.number().int("Los plazos deben ser un número entero.").min(1, "Al menos un plazo.").max(60, "Como mucho 60 plazos."),
  mesesEntrePlazos: z.coerce.number().int().min(1).max(12),
  primerVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha del primer plazo."),
  puntoId: z.uuid().optional().or(z.literal("")),
});

function refrescar() {
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/derramas");
  revalidatePath("/finanzas/recibos");
  revalidatePath("/panel");
}

export async function crearDerrama(_estado: EstadoDerrama, datos: FormData): Promise<EstadoDerrama> {
  const contexto = await requerirContexto();
  if (!puedeEditarFinanzas(contexto.miembro.rol, contexto.esAdminPlataforma)) return SIN_PERMISO;

  const resultado = esquema.safeParse({
    titulo: datos.get("titulo"),
    descripcion: datos.get("descripcion") || undefined,
    importeTotal: datos.get("importeTotal"),
    plazos: datos.get("plazos"),
    mesesEntrePlazos: datos.get("mesesEntrePlazos") || 1,
    primerVencimiento: datos.get("primerVencimiento"),
    puntoId: datos.get("puntoId") || "",
  });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const d = resultado.data;

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("crear_derrama", {
    p_comunidad_id: contexto.comunidad.id,
    p_titulo: d.titulo,
    p_descripcion: d.descripcion ?? null,
    p_importe_total: d.importeTotal,
    p_plazos: d.plazos,
    p_primer_vencimiento: d.primerVencimiento,
    p_meses_entre_plazos: d.mesesEntrePlazos,
    p_punto_id: d.puntoId || null,
  });

  if (error) {
    if (error.message.includes("título")) return { error: error.message };
    if (error.message.includes("coeficiente")) {
      return { error: "Ninguna finca tiene coeficiente. Ponlos primero en Ajustes." };
    }
    if (error.message.includes("acuerdo")) return { error: "El acuerdo elegido no es de esta comunidad." };
    return { error: "No se pudo crear la derrama." };
  }

  refrescar();
  enviarAvisosDespues(contexto.comunidad.id);
  const plazo = d.plazos > 1 ? ` en ${d.plazos} plazos` : "";
  return {
    ok: true,
    mensaje: `Derrama de ${formatoMoneda(d.importeTotal)}${plazo} creada. Cada vivienda ya tiene sus recibos.`,
  };
}

export async function anularDerrama(_estado: EstadoDerrama, datos: FormData): Promise<EstadoDerrama> {
  const contexto = await requerirContexto();
  if (!puedeEditarFinanzas(contexto.miembro.rol, contexto.esAdminPlataforma)) return SIN_PERMISO;

  const id = z.uuid().safeParse(datos.get("derramaId"));
  if (!id.success) return { error: "La derrama no es válida." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("anular_derrama", { p_derrama_id: id.data });
  if (error) return { error: "No se pudo anular la derrama." };

  refrescar();
  const anulados = data ?? 0;
  return {
    ok: true,
    mensaje: `Derrama anulada. ${anulados} ${anulados === 1 ? "recibo anulado" : "recibos anulados"}; los que ya tenían cobros se mantienen.`,
  };
}
