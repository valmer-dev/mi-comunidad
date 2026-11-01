"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
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
  const { miembro, comunidad } = await requerirContexto();
  if (miembro.rol !== "presidente") {
    return { error: "Solo el presidente puede editar los datos de la comunidad." };
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
