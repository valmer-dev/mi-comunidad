import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  permisosDeRol,
  TODOS_LOS_PERMISOS,
  type PermisosRol,
  type RolSistema,
} from "@/lib/permisos";
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
 * Contexto completo del usuario: perfil, comunidad, rol y permisos.
 * Los permisos se leen de la tabla roles; el administrador de plataforma
 * siempre tiene todos.
 */
export const obtenerContexto = cache(async () => {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/entrar");

  const supabase = await crearClienteServidor();
  const almacen = await cookies();
  const comunidadActiva = almacen.get("comunidad_activa")?.value;

  // Un administrador de plataforma puede pertenecer a varias comunidades.
  // La cookie guarda la que esta viendo; si no es valida, se usa la primera.
  const [{ data: miembros }, { data: roles }] = await Promise.all([
    supabase
      .from("miembros")
      .select("*, comunidades(*), perfiles(*)")
      .eq("usuario_id", usuario.id)
      .eq("estado", "activo")
      .order("creado_en", { ascending: true }),
    supabase.from("roles").select("*").order("orden", { ascending: true }),
  ]);

  const listaRoles: RolSistema[] = roles ?? [];

  const miembro =
    (comunidadActiva
      ? miembros?.find((fila) => fila.comunidad_id === comunidadActiva)
      : null) ??
    miembros?.[0] ??
    null;

  if (!miembro) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("*")
      .eq("id", usuario.id)
      .maybeSingle();

    const esAdminPlataforma = Boolean(perfil?.es_admin_plataforma);

    return {
      usuario,
      perfil: perfil ?? null,
      miembro: null,
      comunidad: null,
      roles: listaRoles,
      esAdminPlataforma,
      permisos: esAdminPlataforma ? TODOS_LOS_PERMISOS : permisosDeRol(null, listaRoles),
    };
  }

  const { comunidades, perfiles, ...datosMiembro } = miembro;
  const esAdminPlataforma = Boolean(perfiles?.es_admin_plataforma);
  const permisos: PermisosRol = esAdminPlataforma
    ? TODOS_LOS_PERMISOS
    : permisosDeRol(datosMiembro.rol, listaRoles);

  return {
    usuario,
    perfil: perfiles ?? null,
    miembro: datosMiembro,
    comunidad: comunidades ?? null,
    roles: listaRoles,
    esAdminPlataforma,
    permisos,
  };
});

/** Igual que obtenerContexto, pero exige pertenecer a una comunidad. */
export const requerirContexto = cache(async () => {
  const contexto = await obtenerContexto();
  if (!contexto.miembro || !contexto.comunidad) {
    redirect(contexto.esAdminPlataforma ? "/plataforma" : "/sin-acceso");
  }
  return {
    ...contexto,
    miembro: contexto.miembro,
    comunidad: contexto.comunidad,
  };
});
