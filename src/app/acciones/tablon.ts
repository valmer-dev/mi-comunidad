"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const esquema = z.object({
  titulo: z.string().trim().min(3, "El título es demasiado corto."),
  contenido: z.string().trim().min(5, "Escribe el contenido del anuncio."),
  fijado: z.enum(["on", "off"]).optional(),
});

export type EstadoAnuncio = { error?: string; ok?: boolean };

export async function publicarAnuncio(
  _estado: EstadoAnuncio,
  datos: FormData,
): Promise<EstadoAnuncio> {
  const { usuario, miembro, comunidad } = await requerirContexto();
  if (!esAdministrador(miembro.rol)) {
    return { error: "Solo la junta directiva puede publicar anuncios." };
  }

  const resultado = esquema.safeParse({
    titulo: datos.get("titulo"),
    contenido: datos.get("contenido"),
    fijado: datos.get("fijado") ?? undefined,
  });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("anuncios").insert({
    comunidad_id: comunidad.id,
    titulo: resultado.data.titulo,
    contenido: resultado.data.contenido,
    fijado: resultado.data.fijado === "on",
    autor_id: usuario.id,
  });

  if (error) return { error: "No se pudo publicar el anuncio." };

  revalidatePath("/tablon");
  revalidatePath("/panel");
  return { ok: true };
}
