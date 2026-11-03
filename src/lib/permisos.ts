import type { Database } from "@/lib/tipos-bd";

export type RolMiembro = Database["public"]["Enums"]["rol_miembro"];
export type RolSistema = Database["public"]["Tables"]["roles"]["Row"];

/** Permisos que se guardan en la tabla roles. */
export type PermisosRol = {
  administra_comunidad: boolean;
  gestiona_vecinos: boolean;
  gestiona_documentos: boolean;
  gestiona_incidencias: boolean;
  ver_finanzas: boolean;
};

export const SIN_PERMISOS: PermisosRol = {
  administra_comunidad: false,
  gestiona_vecinos: false,
  gestiona_documentos: false,
  gestiona_incidencias: false,
  ver_finanzas: false,
};

export const TODOS_LOS_PERMISOS: PermisosRol = {
  administra_comunidad: true,
  gestiona_vecinos: true,
  gestiona_documentos: true,
  gestiona_incidencias: true,
  ver_finanzas: true,
};

/**
 * Permisos de los roles que no tienen fila en la tabla roles (roles antiguos
 * que se mantienen en el enum por compatibilidad).
 */
export const PERMISOS_POR_DEFECTO: Record<RolMiembro, PermisosRol> = {
  presidente: TODOS_LOS_PERMISOS,
  vicepresidente: TODOS_LOS_PERMISOS,
  secretario: {
    ...SIN_PERMISOS,
    administra_comunidad: true,
    gestiona_vecinos: true,
    ver_finanzas: true,
  },
  vocal: {
    ...SIN_PERMISOS,
    gestiona_documentos: true,
    gestiona_incidencias: true,
    ver_finanzas: true,
  },
  vecino: SIN_PERMISOS,
  propietario: SIN_PERMISOS,
  inquilino: SIN_PERMISOS,
  administrador_fincas: {
    ...SIN_PERMISOS,
    ver_finanzas: true,
  },
};

/** Permisos efectivos de un rol, leyendo primero la tabla roles. */
export function permisosDeRol(
  rol: RolMiembro | null | undefined,
  roles?: RolSistema[] | null,
): PermisosRol {
  if (!rol) return SIN_PERMISOS;

  const fila = roles?.find((filaRol) => filaRol.clave === rol);
  if (!fila) return PERMISOS_POR_DEFECTO[rol] ?? SIN_PERMISOS;

  return {
    administra_comunidad: fila.administra_comunidad,
    gestiona_vecinos: fila.gestiona_vecinos,
    gestiona_documentos: fila.gestiona_documentos,
    gestiona_incidencias: fila.gestiona_incidencias,
    ver_finanzas: fila.ver_finanzas,
  };
}

export function esAdministrador(permisos: PermisosRol | null | undefined) {
  return Boolean(permisos?.administra_comunidad);
}

export function puedeGestionarVecinos(permisos: PermisosRol | null | undefined) {
  return Boolean(permisos?.gestiona_vecinos);
}

export function puedeVerFinanzas(permisos: PermisosRol | null | undefined) {
  return Boolean(permisos?.ver_finanzas);
}

export function puedeGestionarIncidencias(permisos: PermisosRol | null | undefined) {
  return Boolean(permisos?.gestiona_incidencias);
}

export function puedeGestionarDocumentos(permisos: PermisosRol | null | undefined) {
  return Boolean(permisos?.gestiona_documentos);
}

export const ETIQUETAS_ROL: Record<RolMiembro, string> = {
  presidente: "Presidente",
  vicepresidente: "Vicepresidente",
  secretario: "Secretario",
  vocal: "Vocal",
  vecino: "Vecino",
  propietario: "Propietario",
  inquilino: "Inquilino",
  administrador_fincas: "Administrador de fincas",
};

export type RolAsignable = RolMiembro | "administrador_plataforma";

/** Nombre visible del rol, usando el que se haya editado en la tabla roles. */
export function etiquetaRol(
  rol: RolAsignable | null | undefined,
  roles?: RolSistema[] | null,
) {
  if (!rol) return "";
  return (
    roles?.find((fila) => fila.clave === rol)?.nombre ??
    ETIQUETAS_ROL[rol as RolMiembro] ??
    rol
  );
}

/**
 * Etiqueta visible de una persona. El acceso de administrador de la plataforma
 * manda sobre el rol que tenga en la comunidad.
 */
export function etiquetaRolPersona(
  rol: RolMiembro | null | undefined,
  esAdminPlataforma: boolean | null | undefined,
  roles?: RolSistema[] | null,
) {
  if (esAdminPlataforma) return etiquetaRol("administrador_plataforma", roles);
  return etiquetaRol(rol, roles);
}

export type OpcionRol = {
  valor: RolAsignable;
  etiqueta: string;
  ayuda: string;
};

const AYUDA_ROL: Record<RolMiembro, string> = {
  presidente: "Administra la comunidad",
  vicepresidente: "Sustituye al presidente",
  vocal: "Junta directiva, sin edición",
  vecino: "Solo consulta sus datos",
  secretario: "Administra la comunidad y los vecinos",
  propietario: "Solo consulta sus datos",
  inquilino: "Solo consulta sus datos",
  administrador_fincas: "Consulta las finanzas",
};

const ROLES_COMUNIDAD: RolMiembro[] = [
  "presidente",
  "vicepresidente",
  "vocal",
  "vecino",
];

/**
 * Opciones del selector de rol. Los cuatro roles de la comunidad y, al final,
 * el acceso de administrador de la plataforma.
 */
export function opcionesDeRol(roles?: RolSistema[] | null): OpcionRol[] {
  const opciones: OpcionRol[] = ROLES_COMUNIDAD.map((clave) => {
    const fila = roles?.find((rol) => rol.clave === clave);
    return {
      valor: clave,
      etiqueta: fila?.nombre ?? ETIQUETAS_ROL[clave],
      ayuda: fila?.descripcion ?? AYUDA_ROL[clave],
    };
  });

  const plataforma = roles?.find((rol) => rol.clave === "administrador_plataforma");
  opciones.push({
    valor: "administrador_plataforma",
    etiqueta: plataforma?.nombre ?? "Administrador Plataforma",
    ayuda:
      plataforma?.descripcion ??
      "Acceso total a todas las comunidades y al módulo de plataforma.",
  });

  return opciones;
}
