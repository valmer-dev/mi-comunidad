import { cache } from "react";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type UsuarioSesion = { id: string };

/**
 * Usuario autenticado (o null). Cacheado por peticion.
 *
 * Usa getClaims(): verifica la firma del JWT en local con las claves publicas
 * del proyecto (JWKS, cacheadas en memoria). Asi no hace falta llamar al
 * servidor de Auth en cada navegacion, que era lo que mas frenaba el cambio
 * de modulo. Con tokens simetricos getClaims cae a getUser automaticamente.
 */
export const obtenerUsuarioActual = cache(async (): Promise<UsuarioSesion | null> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.getClaims();

  const id = data?.claims?.sub;
  if (error || typeof id !== "string") return null;

  return { id };
});

/**
 * Contexto completo del usuario: perfil, comunidad y rol.
 * Una sola consulta a la base de datos (perfil y comunidad vienen anidados).
 * Si no hay sesion redirige a /entrar.
 */
export const obtenerContexto = cache(async () => {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/entrar");

  const supabase = await crearClienteServidor();

  const { data: miembro } = await supabase
    .from("miembros")
    .select("*, comunidades(*), perfiles(*)")
    .eq("usuario_id", usuario.id)
    .eq("estado", "activo")
    .limit(1)
    .maybeSingle();

  if (!miembro) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("*")
      .eq("id", usuario.id)
      .maybeSingle();

    return { usuario, perfil: perfil ?? null, miembro: null, comunidad: null };
  }

  const { comunidades, perfiles, ...datosMiembro } = miembro;

  return {
    usuario,
    perfil: perfiles ?? null,
    miembro: datosMiembro,
    comunidad: comunidades ?? null,
  };
});

/** Igual que obtenerContexto, pero exige pertenecer a una comunidad. */
export const requerirContexto = cache(async () => {
  const contexto = await obtenerContexto();
  if (!contexto.miembro || !contexto.comunidad) redirect("/sin-acceso");
  return {
    ...contexto,
    miembro: contexto.miembro,
    comunidad: contexto.comunidad,
  };
});
