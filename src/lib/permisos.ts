import type { Database } from "@/lib/tipos-bd";

export type RolMiembro = Database["public"]["Enums"]["rol_miembro"];

const ADMINISTRADORES: RolMiembro[] = ["presidente", "vicepresidente", "secretario"];
const FINANZAS: RolMiembro[] = [
  "presidente",
  "vicepresidente",
  "secretario",
  "vocal",
  "administrador_fincas",
];

export function esAdministrador(rol: RolMiembro | null | undefined) {
  return !!rol && ADMINISTRADORES.includes(rol);
}

export function puedeVerFinanzas(rol: RolMiembro | null | undefined) {
  return !!rol && FINANZAS.includes(rol);
}

export const ETIQUETAS_ROL: Record<RolMiembro, string> = {
  presidente: "Presidente",
  vicepresidente: "Vicepresidente",
  secretario: "Secretario",
  vocal: "Vocal",
  propietario: "Propietario",
  inquilino: "Inquilino",
  administrador_fincas: "Administrador de fincas",
};
