import { cache } from "react";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/** Usuario autenticado (o null). Cacheado por peticion. */
export const obtenerUsuarioActual = cache(async () => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
});

/**
 * Contexto completo del usuario: perfil, comunidad y rol.
 * Si no hay sesion redirige a /entrar.
 */
export const obtenerContexto = cache(async () => {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/entrar");

  const supabase = await crearClienteServidor();

  const [{ data: perfil }, { data: miembro }] = await Promise.all([
    supabase.from("perfiles").select("*").eq("id", usuario.id).maybeSingle(),
    supabase
      .from("miembros")
      .select("*")
      .eq("usuario_id", usuario.id)
      .eq("estado", "activo")
      .limit(1)
      .maybeSingle(),
  ]);

  if (!miembro) {
    return { usuario, perfil, miembro: null, comunidad: null };
  }

  const { data: comunidad } = await supabase
    .from("comunidades")
    .select("*")
    .eq("id", miembro.comunidad_id)
    .maybeSingle();

  return { usuario, perfil, miembro, comunidad };
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
