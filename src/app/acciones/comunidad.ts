"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const esquema = z.object({
  nombre: z.string().trim().min(3, "El nombre de la comunidad es obligatorio."),
  direccion: z.string().trim().optional(),
  codigoPostal: z.string().trim().optional(),
  ciudad: z.string().trim().optional(),
  provincia: z.string().trim().optional(),
  cif: z.string().trim().optional(),
  iban: z.string().trim().optional(),
  administradorNombre: z.string().trim().optional(),
  administradorTelefono: z.string().trim().optional(),
  administradorCorreo: z.string().trim().optional(),
});

export type EstadoComunidad = { error?: string; ok?: boolean };

export async function actualizarComunidad(
  _estado: EstadoComunidad,
  datos: FormData,
): Promise<EstadoComunidad> {
  const { comunidad, permisos } = await requerirContexto();
  if (!esAdministrador(permisos)) {
    return { error: "Solo quien administra la comunidad puede editar sus datos." };
  }

  const resultado = esquema.safeParse({
    nombre: datos.get("nombre"),
    direccion: datos.get("direccion"),
    codigoPostal: datos.get("codigoPostal"),
    ciudad: datos.get("ciudad"),
    provincia: datos.get("provincia"),
    cif: datos.get("cif"),
    iban: datos.get("iban"),
    administradorNombre: datos.get("administradorNombre"),
    administradorTelefono: datos.get("administradorTelefono"),
    administradorCorreo: datos.get("administradorCorreo"),
  });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("comunidades")
    .update({
      nombre: resultado.data.nombre,
      direccion: resultado.data.direccion || null,
      codigo_postal: resultado.data.codigoPostal || null,
      ciudad: resultado.data.ciudad || null,
      provincia: resultado.data.provincia || null,
      cif: resultado.data.cif || null,
      iban: resultado.data.iban || null,
      administrador_nombre: resultado.data.administradorNombre || null,
      administrador_telefono: resultado.data.administradorTelefono || null,
      administrador_correo: resultado.data.administradorCorreo || null,
    })
    .eq("id", comunidad.id);

  if (error) return { error: "No se pudieron guardar los datos." };

  revalidatePath("/ajustes");
  revalidatePath("/panel");
  revalidatePath("/", "layout");
  return { ok: true };
}

const esquemaFincas = z.object({
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

export type EstadoFincas =
  | { error?: string }
  | { ok: true; mensaje: string };

/**
 * Crea o ajusta las casas y los pisos de la comunidad y reparte el coeficiente
 * a partes iguales. Las fincas que ya tienen titulares nunca se eliminan.
 */
export async function configurarFincas(
  _estado: EstadoFincas,
  datos: FormData,
): Promise<EstadoFincas> {
  const { comunidad, permisos } = await requerirContexto();
  if (!esAdministrador(permisos)) {
    return { error: "Solo quien administra la comunidad puede cambiar las casas y pisos." };
  }

  const resultado = esquemaFincas.safeParse({
    numeroCasas: datos.get("numeroCasas"),
    numeroPisos: datos.get("numeroPisos"),
  });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const { numeroCasas, numeroPisos } = resultado.data;
  if (numeroCasas + numeroPisos === 0) {
    return { error: "Indica al menos una casa o un piso." };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("configurar_fincas", {
    p_comunidad_id: comunidad.id,
    p_casas: numeroCasas,
    p_pisos: numeroPisos,
  });

  if (error) {
    return { error: "No se pudieron actualizar las casas y los pisos." };
  }

  const resumen = (data ?? {}) as {
    creadas?: number;
    eliminadas?: number;
    total?: number;
  };
  const partes: string[] = [
    `${resumen.total ?? numeroCasas + numeroPisos} fincas en total`,
  ];
  if (resumen.creadas) partes.push(`${resumen.creadas} creadas`);
  if (resumen.eliminadas) partes.push(`${resumen.eliminadas} eliminadas sin titulares`);

  revalidatePath("/ajustes");
  revalidatePath("/vecinos");
  revalidatePath("/panel");
  revalidatePath("/", "layout");

  return { ok: true, mensaje: `Hecho: ${partes.join(", ")}.` };
}
