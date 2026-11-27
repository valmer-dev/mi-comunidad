"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { escaparHtml, MEDIOS_CONVOCATORIA, type MedioConvocatoria } from "@/lib/convocatoria";
import { cargarConvocatoria } from "@/lib/datos-convocatoria";
import { esAdministrador } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFechaHora } from "@/lib/utilidades";

/**
 * Registrar el envio de la convocatoria por un medio. La primera vez queda
 * la fecha de envio, que es la que cuenta para la antelacion. Publicar en el
 * tablon crea ademas un anuncio fijado con el orden del dia.
 */

export type EstadoConvocatoria = { error?: string; ok?: boolean; mensaje?: string };

const esquema = z.object({
  juntaId: z.string().uuid("Junta no válida."),
  medio: z.enum(Object.keys(MEDIOS_CONVOCATORIA) as [MedioConvocatoria, ...MedioConvocatoria[]]),
});

function enlaceConvocatoria(juntaId: string) {
  const base = (process.env.NEXT_PUBLIC_URL_APP ?? "").replace(/\/$/, "");
  return `${base}/juntas/${juntaId}/convocatoria`;
}

export async function registrarEnvioConvocatoria(
  _estado: EstadoConvocatoria,
  datos: FormData,
): Promise<EstadoConvocatoria> {
  const { usuario, comunidad, permisos } = await requerirContexto();
  if (!esAdministrador(permisos)) {
    return { error: "Solo la junta directiva puede enviar convocatorias." };
  }

  const resultado = esquema.safeParse({ juntaId: datos.get("junta_id"), medio: datos.get("medio") });
  if (!resultado.success) return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  const { juntaId, medio } = resultado.data;

  const supabase = await crearClienteServidor();
  const convocatoria = await cargarConvocatoria(supabase, juntaId, comunidad.id);
  if (!convocatoria) return { error: "No se encontró la junta." };
  const { junta, puntos, morosos, presidente } = convocatoria;
  if (junta.estado !== "convocada") {
    return { error: "La junta ya se ha celebrado." };
  }

  let anuncioId = junta.convocatoria_anuncio_id;
  if (medio === "tablon" && !anuncioId) {
    const segunda =
      junta.segunda_convocatoria_minutos > 0
        ? `, y en segunda convocatoria ${junta.segunda_convocatoria_minutos} minutos después`
        : "";
    const html = [
      `<p>${escaparHtml(presidente ? `${presidente}, presidente de la comunidad,` : "La presidencia de la comunidad")} convoca junta ${escaparHtml(junta.tipo)} para el <strong>${escaparHtml(formatoFechaHora(junta.fecha_hora))}</strong> en primera convocatoria${segunda}${junta.lugar ? `, en ${escaparHtml(junta.lugar)}` : ""}.</p>`,
      puntos.length > 0
        ? `<p><strong>Orden del día</strong></p><ol>${puntos.map((punto) => `<li>${escaparHtml(punto.titulo)}</li>`).join("")}</ol>`
        : "",
      morosos.length > 0
        ? `<p><strong>Propietarios que no están al corriente de pago</strong> (podrán asistir pero no votar, art. 15.2 LPH): ${escaparHtml(morosos.map((moroso) => moroso.codigo).join(", "))}.</p>`
        : "",
      `<p>Convocatoria completa y modelo de representación: <a href="${escaparHtml(enlaceConvocatoria(junta.id))}">abrir convocatoria</a>.</p>`,
    ].join("");

    const { data: anuncio, error } = await supabase
      .from("anuncios")
      .insert({
        comunidad_id: comunidad.id,
        titulo: `Convocatoria: ${junta.titulo}`,
        contenido: html,
        fijado: true,
        caduca_en: junta.fecha_hora.slice(0, 10),
        autor_id: usuario.id,
      })
      .select("id")
      .single();
    if (error || !anuncio) return { error: "No se pudo publicar en el tablón." };
    anuncioId = anuncio.id;
  }

  const medios = [...new Set([...(junta.convocatoria_medios ?? []), medio])];
  const { error } = await supabase
    .from("juntas")
    .update({
      convocatoria_enviada_en: junta.convocatoria_enviada_en ?? new Date().toISOString(),
      convocatoria_medios: medios,
      convocatoria_anuncio_id: anuncioId,
    })
    .eq("id", junta.id);
  if (error) return { error: "No se pudo registrar el envío." };

  revalidatePath(`/juntas/${junta.id}`);
  revalidatePath("/juntas");
  revalidatePath("/tablon");
  revalidatePath("/panel");
  return { ok: true, mensaje: `Anotado: ${MEDIOS_CONVOCATORIA[medio].toLowerCase()}.` };
}
