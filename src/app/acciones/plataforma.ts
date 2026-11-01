"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { obtenerContexto } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const esquema = z.object({
  nombre: z.string().trim().min(3, "El nombre de la comunidad es obligatorio."),
  direccion: z.string().trim().optional(),
  codigoPostal: z.string().trim().optional(),
  ciudad: z.string().trim().optional(),
  provincia: z.string().trim().optional(),
  numeroCasas: z.coerce
    .number()
    .int("Escribe un número entero de casas.")
    .min(0, "El número de casas no puede ser negativo.")
    .max(500, "Como máximo 500 casas."),
  numeroPisos: z.coerce
    .number()
    .int("Escribe un número entero de pisos.")
    .min(0, "El número de pisos no puede ser negativo.")
    .max(500, "Como máximo 500 pisos."),
});

export type EstadoPlataforma = { error?: string };

/**
 * Crea una comunidad nueva desde /plataforma. Quien la crea queda como
 * presidente y se generan sus casas y pisos.
 */
export async function crearComunidad(
  _estado: EstadoPlataforma,
  datos: FormData,
): Promise<EstadoPlataforma> {
  const { usuario, esAdminPlataforma } = await obtenerContexto();
  if (!esAdminPlataforma) {
    return { error: "Solo el administrador de la plataforma puede crear comunidades." };
  }

  const resultado = esquema.safeParse({
    nombre: datos.get("nombre"),
    direccion: datos.get("direccion"),
    codigoPostal: datos.get("codigoPostal"),
    ciudad: datos.get("ciudad"),
    provincia: datos.get("provincia"),
    numeroCasas: datos.get("numeroCasas"),
    numeroPisos: datos.get("numeroPisos"),
  });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const { nombre, direccion, codigoPostal, ciudad, provincia, numeroCasas, numeroPisos } =
    resultado.data;

  if (numeroCasas + numeroPisos === 0) {
    return { error: "Indica al menos una casa o un piso." };
  }

  const supabase = await crearClienteServidor();

  const { data: comunidad, error } = await supabase
    .from("comunidades")
    .insert({
      nombre,
      direccion: direccion || null,
      codigo_postal: codigoPostal || null,
      ciudad: ciudad || null,
      provincia: provincia || null,
      numero_casas: numeroCasas,
      numero_pisos: numeroPisos,
    })
    .select("id")
    .single();

  if (error || !comunidad) {
    return { error: "No se pudo crear la comunidad." };
  }

  const { error: errorMiembro } = await supabase.from("miembros").insert({
    comunidad_id: comunidad.id,
    usuario_id: usuario.id,
    rol: "presidente",
    estado: "activo",
  });

  if (errorMiembro) {
    await supabase.from("comunidades").delete().eq("id", comunidad.id);
    return { error: "No se pudo añadirte como presidente de la comunidad." };
  }

  const { error: errorFincas } = await supabase.rpc("configurar_fincas", {
    p_comunidad_id: comunidad.id,
    p_casas: numeroCasas,
    p_pisos: numeroPisos,
  });

  if (errorFincas) {
    await supabase.from("comunidades").delete().eq("id", comunidad.id);
    return { error: "No se pudieron crear las casas y los pisos." };
  }

  const almacen = await cookies();
  almacen.set("comunidad_activa", comunidad.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });

  revalidatePath("/", "layout");
  redirect("/panel");
}

/** Cambia la comunidad que se está viendo (solo si se pertenece a ella). */
export async function abrirComunidad(datos: FormData) {
  const { usuario } = await obtenerContexto();
  const comunidadId = String(datos.get("comunidadId") ?? "");
  if (!comunidadId) redirect("/plataforma");

  const supabase = await crearClienteServidor();
  const { data: miembro } = await supabase
    .from("miembros")
    .select("id")
    .eq("usuario_id", usuario.id)
    .eq("comunidad_id", comunidadId)
    .eq("estado", "activo")
    .maybeSingle();

  if (!miembro) redirect("/plataforma");

  const almacen = await cookies();
  almacen.set("comunidad_activa", comunidadId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });

  revalidatePath("/", "layout");
  redirect("/panel");
}
