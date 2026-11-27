"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { calcularDeuda } from "@/lib/certificados";
import { esAdministrador, puedeEditarFinanzas } from "@/lib/permisos";
import { hoyISO } from "@/lib/recibos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { COLUMNAS_RECIBO, normalizarRecibos } from "@/app/(app)/finanzas/recibos/datos";

/**
 * Certificados de deuda para la venta de una vivienda (art. 9.1.e LPH). Se
 * anota la solicitud y se emite en el momento o despues, con la deuda que
 * haya ese dia.
 */

export type EstadoCertificado = { error?: string; ok?: boolean; mensaje?: string };

const SIN_PERMISO = { error: "Solo la junta puede expedir certificados de deuda." };

async function contextoEditor() {
  const contexto = await requerirContexto();
  const puede =
    esAdministrador(contexto.permisos) ||
    puedeEditarFinanzas(contexto.miembro.rol, contexto.esAdminPlataforma);
  return puede ? contexto : null;
}

async function deudaDe(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, fincaId: string, hoy: string) {
  const { data } = await supabase.from("recibos").select(COLUMNAS_RECIBO).eq("finca_id", fincaId);
  return calcularDeuda(normalizarRecibos(data), hoy);
}

const esquema = z.object({
  fincaId: z.uuid("Vivienda no válida."),
  solicitante: z.string().trim().min(2, "Escribe quién lo pide.").max(160, "El nombre es demasiado largo."),
  motivo: z.enum(["compraventa", "otro"]),
  solicitadoEn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de la solicitud no es válida."),
  emitir: z.boolean(),
});

export async function solicitarCertificado(_estado: EstadoCertificado, datos: FormData): Promise<EstadoCertificado> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;

  const resultado = esquema.safeParse({
    fincaId: datos.get("fincaId"),
    solicitante: datos.get("solicitante"),
    motivo: datos.get("motivo") || "compraventa",
    solicitadoEn: datos.get("solicitadoEn"),
    emitir: datos.get("emitir") === "si",
  });
  if (!resultado.success) return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  const d = resultado.data;
  const hoy = hoyISO();
  if (d.solicitadoEn > hoy) return { error: "La fecha de la solicitud no puede ser futura." };

  const supabase = await crearClienteServidor();
  const deuda = d.emitir ? await deudaDe(supabase, d.fincaId, hoy) : null;
  const { data: creado, error } = await supabase
    .from("certificados_deuda")
    .insert({
      comunidad_id: contexto.comunidad.id,
      finca_id: d.fincaId,
      solicitante: d.solicitante,
      motivo: d.motivo,
      solicitado_en: d.solicitadoEn,
      creado_por: contexto.usuario.id,
      ...(deuda
        ? {
            emitido_en: hoy,
            deuda_total: deuda.total,
            deuda_vencida: deuda.vencida,
            deuda_afecta: deuda.afecta,
            detalle: deuda.detalle,
          }
        : {}),
    })
    .select("id")
    .single();

  if (error || !creado) {
    if (error?.code === "22023") return { error: `${error.message}.` };
    return { error: "No se pudo guardar el certificado." };
  }

  revalidatePath(`/finanzas/recibos/${d.fincaId}`);
  revalidatePath("/calendario");
  if (deuda) redirect(`/finanzas/recibos/${d.fincaId}/certificado/${creado.id}`);
  return { ok: true, mensaje: "Solicitud anotada. Tienes 7 días naturales para emitir el certificado." };
}

export async function emitirCertificado(_estado: EstadoCertificado, datos: FormData): Promise<EstadoCertificado> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;
  const id = z.uuid().safeParse(datos.get("id"));
  if (!id.success) return { error: "Certificado no válido." };

  const supabase = await crearClienteServidor();
  const { data: certificado } = await supabase
    .from("certificados_deuda")
    .select("id, finca_id, emitido_en")
    .eq("id", id.data)
    .eq("comunidad_id", contexto.comunidad.id)
    .maybeSingle();
  if (!certificado) return { error: "No se encontró la solicitud." };

  if (!certificado.emitido_en) {
    const hoy = hoyISO();
    const deuda = await deudaDe(supabase, certificado.finca_id, hoy);
    const { error } = await supabase
      .from("certificados_deuda")
      .update({
        emitido_en: hoy,
        deuda_total: deuda.total,
        deuda_vencida: deuda.vencida,
        deuda_afecta: deuda.afecta,
        detalle: deuda.detalle,
      })
      .eq("id", certificado.id);
    if (error) return { error: "No se pudo emitir el certificado." };
    revalidatePath(`/finanzas/recibos/${certificado.finca_id}`);
    revalidatePath("/calendario");
  }

  redirect(`/finanzas/recibos/${certificado.finca_id}/certificado/${certificado.id}`);
}

export async function eliminarSolicitudCertificado(
  _estado: EstadoCertificado,
  datos: FormData,
): Promise<EstadoCertificado> {
  const contexto = await contextoEditor();
  if (!contexto) return SIN_PERMISO;
  const id = z.uuid().safeParse(datos.get("id"));
  if (!id.success) return { error: "Solicitud no válida." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("certificados_deuda")
    .delete()
    .eq("id", id.data)
    .eq("comunidad_id", contexto.comunidad.id)
    .is("emitido_en", null)
    .select("finca_id")
    .maybeSingle();
  if (error || !data) return { error: "No se pudo borrar la solicitud." };

  revalidatePath(`/finanzas/recibos/${data.finca_id}`);
  revalidatePath("/calendario");
  return { ok: true };
}
