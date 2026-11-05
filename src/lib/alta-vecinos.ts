import { generarContrasenaTemporal } from "@/lib/contrasenas";
import { correoDesdeTelefono } from "@/lib/telefono";
import type { crearClienteAdmin } from "@/lib/supabase/admin";

export type ClienteAdmin = ReturnType<typeof crearClienteAdmin>;

export type CuentaCreada = {
  nombre: string;
  telefono: string | null;
  /** Solo si se indico un correo real (no el interno del telefono). */
  correo: string | null;
  contrasena: string;
};

/**
 * Busca una cuenta por telefono o por correo. El telefono manda: es el
 * identificador que se entrega al vecino.
 */
export async function buscarPerfilPorContacto(
  admin: ClienteAdmin,
  telefono: string | null,
  correo: string | null,
): Promise<
  | { conflicto: true }
  | { conflicto?: false; perfil: { id: string } | null }
> {
  const porTelefono = telefono
    ? (await admin.from("perfiles").select("id").eq("telefono", telefono).maybeSingle())
        .data
    : null;

  const porCorreo = correo
    ? (await admin.from("perfiles").select("id").ilike("correo", correo).maybeSingle())
        .data
    : null;

  if (porTelefono && porCorreo && porTelefono.id !== porCorreo.id) {
    return { conflicto: true };
  }

  return { perfil: porTelefono ?? porCorreo ?? null };
}

/** Crea una cuenta de Auth para un vecino y guarda su telefono en el perfil. */
export async function crearCuentaVecino(
  admin: ClienteAdmin,
  datos: { nombre: string; telefono: string | null; correo: string | null },
): Promise<{ error: true } | { usuarioId: string; cuenta: CuentaCreada }> {
  const correoAuth =
    datos.correo ?? (datos.telefono ? correoDesdeTelefono(datos.telefono) : null);
  if (!correoAuth) return { error: true };

  const contrasena = generarContrasenaTemporal();
  const { data, error } = await admin.auth.admin.createUser({
    email: correoAuth,
    password: contrasena,
    email_confirm: true,
    user_metadata: { nombre: datos.nombre },
  });

  if (error || !data.user) return { error: true };

  if (datos.telefono) {
    await admin.from("perfiles").update({ telefono: datos.telefono }).eq("id", data.user.id);
  }

  return {
    usuarioId: data.user.id,
    cuenta: {
      nombre: datos.nombre,
      telefono: datos.telefono,
      correo: datos.correo,
      contrasena,
    },
  };
}
