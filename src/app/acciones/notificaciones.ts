"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { obtenerUsuarioActual, requerirContexto } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { esCorreoInterno } from "@/lib/telefono";

/** Abre un aviso: lo marca como leido y lleva a su pagina. */
export async function abrirAviso(datos: FormData) {
  const id = z.string().uuid().safeParse(datos.get("id"));
  if (!id.success) redirect("/notificaciones");

  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/entrar");

  const supabase = await crearClienteServidor();
  const { data: aviso } = await supabase
    .from("notificaciones")
    .update({ leida_en: new Date().toISOString() })
    .eq("id", id.data)
    .eq("usuario_id", usuario.id)
    .select("url")
    .maybeSingle();

  revalidatePath("/", "layout");
  const destino = aviso?.url;
  redirect(destino && destino.startsWith("/") && !destino.startsWith("//") ? destino : "/notificaciones");
}

export async function marcarAvisosLeidos() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return;
  const supabase = await crearClienteServidor();
  await supabase
    .from("notificaciones")
    .update({ leida_en: new Date().toISOString() })
    .eq("usuario_id", usuario.id)
    .is("leida_en", null);
  revalidatePath("/", "layout");
}

/**
 * Anota que la persona ha visto estos anuncios del tablon y da por leidos sus
 * avisos. Se llama desde el navegador al abrir el tablon.
 */
export async function marcarAnunciosLeidos(ids: string[]) {
  const validos = z.array(z.string().uuid()).max(200).safeParse(ids);
  if (!validos.success || validos.data.length === 0) return;

  const usuario = await obtenerUsuarioActual();
  if (!usuario) return;
  const supabase = await crearClienteServidor();

  await supabase
    .from("lecturas_anuncio")
    .upsert(
      validos.data.map((anuncio_id) => ({ anuncio_id, usuario_id: usuario.id })),
      { onConflict: "anuncio_id,usuario_id", ignoreDuplicates: true },
    );

  const { count } = await supabase
    .from("notificaciones")
    .update({ leida_en: new Date().toISOString() }, { count: "exact" })
    .eq("usuario_id", usuario.id)
    .is("leida_en", null)
    .in(
      "url",
      validos.data.map((id) => `/tablon#anuncio-${id}`),
    );
  if (count) revalidatePath("/", "layout");
}

// ------------------------------------------------------------
// Datos de contacto para notificaciones
// ------------------------------------------------------------
export type EstadoContacto = { error?: string; ok?: boolean };

const esquemaContacto = z.object({
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .refine((valor) => valor === "" || z.string().email().safeParse(valor).success, "Escribe un correo válido.")
    .refine((valor) => !esCorreoInterno(valor), "Escribe tu correo real."),
  domicilio: z.string().trim().max(300, "El domicilio es demasiado largo."),
  avisos: z.boolean(),
});

export async function guardarContacto(
  _estado: EstadoContacto,
  datos: FormData,
): Promise<EstadoContacto> {
  const { usuario } = await requerirContexto();
  const resultado = esquemaContacto.safeParse({
    correo: datos.get("correo") ?? "",
    domicilio: datos.get("domicilio") ?? "",
    avisos: datos.get("avisos") === "on",
  });
  if (!resultado.success) return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("perfiles")
    .update({
      correo: resultado.data.correo || null,
      domicilio_notificaciones: resultado.data.domicilio || null,
      avisos_correo: resultado.data.avisos,
    })
    .eq("id", usuario.id);
  if (error) {
    return {
      error: error.code === "23505" ? "Ese correo ya lo usa otra persona." : "No se pudieron guardar tus datos.",
    };
  }

  revalidatePath("/ajustes");
  revalidatePath("/vecinos");
  return { ok: true };
}
