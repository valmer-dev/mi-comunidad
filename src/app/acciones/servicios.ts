"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/**
 * Servicios contratados por la comunidad (mantenimiento, administración,
 * limpieza...). Se guardan en la tabla `proveedores`: `categoria` es el
 * servicio y `nombre` la empresa que lo presta.
 *
 * Los servicios los puede ver cualquier miembro. Solo el Administrador
 * Plataforma, el Presidente y el Vicepresidente pueden crearlos, editarlos o
 * eliminarlos (permiso `administra_comunidad`).
 */

const telefono = z
  .string()
  .trim()
  .min(5, "Escribe un teléfono de contacto.")
  .max(30, "El teléfono es demasiado largo.")
  .refine(
    (valor) => /^[+()\d\s.-]+$/.test(valor),
    "El teléfono solo puede tener números, espacios, +, -, puntos y paréntesis.",
  )
  .refine(
    (valor) => (valor.match(/\d/g) ?? []).length >= 6,
    "El teléfono no parece válido.",
  );

const esquema = z.object({
  servicio: z
    .string()
    .trim()
    .min(3, "Escribe el servicio (por ejemplo, mantenimiento de ascensores).")
    .max(120, "El servicio no puede superar los 120 caracteres."),
  empresa: z
    .string()
    .trim()
    .min(2, "Escribe el nombre de la empresa.")
    .max(140, "El nombre de la empresa no puede superar los 140 caracteres."),
  telefono,
});

const esquemaActualizar = esquema.extend({
  id: z.string().uuid("Servicio no válido."),
});

export type EstadoServicio = { error?: string; ok?: boolean; mensaje?: string };

function sinPermiso(accion: string) {
  return {
    error: `Solo el Administrador Plataforma, el Presidente y el Vicepresidente pueden ${accion} servicios.`,
  };
}

export async function crearServicio(
  _estado: EstadoServicio,
  datos: FormData,
): Promise<EstadoServicio> {
  const { comunidad, permisos } = await requerirContexto();

  if (!esAdministrador(permisos)) return sinPermiso("crear");

  const resultado = esquema.safeParse({
    servicio: datos.get("servicio"),
    empresa: datos.get("empresa"),
    telefono: datos.get("telefono"),
  });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("proveedores").insert({
    comunidad_id: comunidad.id,
    categoria: resultado.data.servicio,
    nombre: resultado.data.empresa,
    telefono: resultado.data.telefono,
  });

  if (error) {
    return { error: "No se pudo guardar el servicio. Inténtalo de nuevo." };
  }

  revalidatePath("/servicios");
  return { ok: true, mensaje: "Servicio añadido." };
}

export async function actualizarServicio(
  _estado: EstadoServicio,
  datos: FormData,
): Promise<EstadoServicio> {
  const { comunidad, permisos } = await requerirContexto();

  if (!esAdministrador(permisos)) return sinPermiso("editar");

  const resultado = esquemaActualizar.safeParse({
    id: datos.get("id"),
    servicio: datos.get("servicio"),
    empresa: datos.get("empresa"),
    telefono: datos.get("telefono"),
  });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("proveedores")
    .update({
      categoria: resultado.data.servicio,
      nombre: resultado.data.empresa,
      telefono: resultado.data.telefono,
    })
    .eq("id", resultado.data.id)
    .eq("comunidad_id", comunidad.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "No se pudo guardar el servicio. Inténtalo de nuevo." };
  }

  if (!data) return { error: "No se encontró el servicio." };

  revalidatePath("/servicios");
  return { ok: true, mensaje: "Servicio actualizado." };
}

export async function eliminarServicio(
  _estado: EstadoServicio,
  datos: FormData,
): Promise<EstadoServicio> {
  const { comunidad, permisos } = await requerirContexto();

  if (!esAdministrador(permisos)) return sinPermiso("eliminar");

  const id = String(datos.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) {
    return { error: "Servicio no válido." };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("proveedores")
    .delete()
    .eq("id", id)
    .eq("comunidad_id", comunidad.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "No se pudo eliminar el servicio. Inténtalo de nuevo." };
  }

  if (!data) return { error: "No se encontró el servicio." };

  revalidatePath("/servicios");
  return { ok: true };
}
