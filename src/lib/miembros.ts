import type { crearClienteServidor } from "@/lib/supabase/servidor";

type ClienteServidor = Awaited<ReturnType<typeof crearClienteServidor>>;

/**
 * Asegura que un usuario sea miembro activo de la comunidad. Se usa al dar de
 * alta a un segundo titular para que tambien pueda entrar por su cuenta.
 *
 * Devuelve false si no se pudo crear la pertenencia (por ejemplo, por falta de
 * permisos), para que la accion pueda revertir el alta en vez de dejarla a
 * medias.
 */
export async function asegurarMiembroComunidad(
  supabase: ClienteServidor,
  datos: { comunidadId: string; usuarioId: string; fincaId: string | null },
): Promise<boolean> {
  const { data: yaEsMiembro } = await supabase
    .from("miembros")
    .select("id")
    .eq("comunidad_id", datos.comunidadId)
    .eq("usuario_id", datos.usuarioId)
    .maybeSingle();

  if (yaEsMiembro) return true;

  const { error } = await supabase.from("miembros").insert({
    comunidad_id: datos.comunidadId,
    usuario_id: datos.usuarioId,
    rol: "vecino",
    estado: "activo",
    finca_principal_id: datos.fincaId,
  });

  return !error;
}
