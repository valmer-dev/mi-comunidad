"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import {
  aDiezmilesimas,
  deDiezmilesimas,
  formatoCoeficiente,
} from "@/lib/coeficientes";
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
 * Crea o ajusta las casas y los pisos de la comunidad. Las fincas que ya
 * tienen titulares nunca se eliminan. Los coeficientes se conservan: solo se
 * reparten a partes iguales si se marca la casilla o si aun no hay ninguno.
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
    p_repartir: datos.get("repartir") === "on",
  });

  if (error) {
    return { error: "No se pudieron actualizar las casas y los pisos." };
  }

  const resumen = (data ?? {}) as {
    creadas?: number;
    eliminadas?: number;
    total?: number;
    repartido?: boolean;
  };
  const partes: string[] = [
    `${resumen.total ?? numeroCasas + numeroPisos} fincas en total`,
  ];
  if (resumen.creadas) partes.push(`${resumen.creadas} creadas`);
  if (resumen.eliminadas) partes.push(`${resumen.eliminadas} eliminadas sin titulares`);
  if (resumen.repartido) partes.push("coeficiente repartido a partes iguales");
  else if (resumen.creadas) partes.push("pon el coeficiente de las nuevas en Coeficientes");

  revalidatePath("/ajustes");
  revalidatePath("/vecinos");
  revalidatePath("/panel");
  revalidatePath("/", "layout");

  return { ok: true, mensaje: `Hecho: ${partes.join(", ")}.` };
}

export type EstadoCoeficientes =
  | { error?: string }
  | { ok: true; mensaje: string };

/**
 * Guarda el coeficiente de participacion de todas las fincas de una vez.
 * El formulario envia un campo `coef_<id de finca>` por finca. La base de
 * datos vuelve a comprobar que estan todas y que suman el total.
 */
export async function guardarCoeficientes(
  _estado: EstadoCoeficientes,
  datos: FormData,
): Promise<EstadoCoeficientes> {
  const { comunidad, permisos } = await requerirContexto();
  if (!esAdministrador(permisos)) {
    return { error: "Solo quien administra la comunidad puede cambiar los coeficientes." };
  }

  const coeficientes: { id: string; coeficiente: number }[] = [];
  let suma = 0;
  for (const [clave, valor] of datos.entries()) {
    if (!clave.startsWith("coef_")) continue;
    const id = clave.slice(5);
    if (!z.string().uuid().safeParse(id).success) {
      return { error: "Hay una finca no válida." };
    }
    const diezmilesimas = aDiezmilesimas(typeof valor === "string" ? valor : null);
    if (diezmilesimas === null || diezmilesimas > 100 * 10_000) {
      return {
        error: "Cada coeficiente debe ser un número entre 0 y 100, con cuatro decimales como mucho.",
      };
    }
    suma += diezmilesimas;
    coeficientes.push({ id, coeficiente: deDiezmilesimas(diezmilesimas) });
  }

  if (coeficientes.length === 0) {
    return { error: "No hay fincas que guardar." };
  }

  const total = aDiezmilesimas(String(comunidad.coeficiente_total ?? 100)) ?? 100 * 10_000;
  if (suma !== total) {
    return {
      error: `Los coeficientes suman ${formatoCoeficiente(deDiezmilesimas(suma))} % y deben sumar ${formatoCoeficiente(deDiezmilesimas(total))} %.`,
    };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("guardar_coeficientes", {
    p_comunidad_id: comunidad.id,
    p_coeficientes: coeficientes,
  });

  if (error) {
    if (error.message.includes("Faltan fincas")) {
      return { error: "Las fincas han cambiado mientras editabas. Recarga la página e inténtalo de nuevo." };
    }
    return { error: "No se pudieron guardar los coeficientes." };
  }

  const resumen = (data ?? {}) as { asistencias_actualizadas?: number };

  revalidatePath("/ajustes");
  revalidatePath("/juntas", "layout");

  const extra = resumen.asistencias_actualizadas
    ? " Se han actualizado también las juntas que aún no se han celebrado."
    : "";
  return { ok: true, mensaje: `Coeficientes guardados.${extra}` };
}
