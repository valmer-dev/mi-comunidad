"use server";

import { z } from "zod";
import { obtenerUsuarioActual } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const esquema = z
  .object({
    contrasena: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
    repetir: z.string(),
  })
  .refine((datos) => datos.contrasena === datos.repetir, {
    message: "Las contraseñas no coinciden.",
    path: ["repetir"],
  });

export type EstadoContrasena = { error?: string; ok?: boolean };

export async function cambiarContrasena(
  _estado: EstadoContrasena,
  datos: FormData,
): Promise<EstadoContrasena> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  const resultado = esquema.safeParse({
    contrasena: datos.get("contrasena"),
    repetir: datos.get("repetir"),
  });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa la contraseña." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.updateUser({
    password: resultado.data.contrasena,
  });

  if (error) return { error: "No se pudo cambiar la contraseña." };

  return { ok: true };
}
