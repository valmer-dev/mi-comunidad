"use client";

import Link from "next/link";
import {
  Building2,
  FolderOpen,
  Gavel,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Settings,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { cerrarSesion } from "@/app/acciones/autenticacion";
import { ETIQUETAS_ROL, type RolMiembro } from "@/lib/permisos";
import { iniciales } from "@/lib/utilidades";
import { EnlaceLateral } from "./EnlaceLateral";

type Props = {
  nombreComunidad: string;
  nombreUsuario: string;
  rol: RolMiembro;
  puedeVerFinanzas: boolean;
};

export function BarraLateral({
  nombreComunidad,
  nombreUsuario,
  rol,
  puedeVerFinanzas,
}: Props) {
  const enlaces = [
    { href: "/panel", etiqueta: "Panel", icono: LayoutDashboard },
    { href: "/tablon", etiqueta: "Tablón", icono: Megaphone },
    { href: "/incidencias", etiqueta: "Incidencias", icono: Wrench },
    { href: "/vecinos", etiqueta: "Vecinos", icono: Users },
    ...(puedeVerFinanzas
      ? [{ href: "/finanzas", etiqueta: "Finanzas", icono: Wallet }]
      : []),
    { href: "/juntas", etiqueta: "Juntas", icono: Gavel },
    { href: "/documentos", etiqueta: "Documentos", icono: FolderOpen },
    { href: "/ajustes", etiqueta: "Ajustes", icono: Settings },
  ];

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-borde bg-superficie px-3 py-5 lg:flex">
      <Link href="/panel" className="flex items-center gap-3 px-3">
        <span className="grid size-10 place-items-center rounded-xl bg-principal text-white">
          <Building2 className="size-5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold leading-tight text-tinta">
            Mi Comunidad
          </span>
          <span className="block truncate text-xs text-suave">{nombreComunidad}</span>
        </span>
      </Link>

      <nav className="mt-7 flex flex-1 flex-col gap-1" aria-label="Navegación principal">
        {enlaces.map((enlace) => (
          <EnlaceLateral key={enlace.href} {...enlace} />
        ))}
      </nav>

      <div className="mt-4 border-t border-borde pt-4">
        <div className="flex items-center gap-3 px-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-principal-claro text-sm font-bold text-principal-oscuro">
            {iniciales(nombreUsuario)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-tinta">
              {nombreUsuario}
            </span>
            <span className="block truncate text-xs text-suave">
              {ETIQUETAS_ROL[rol]}
            </span>
          </span>
        </div>
        <form action={cerrarSesion} className="mt-3 px-1">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-suave transition-colors hover:bg-fondo hover:text-tinta"
          >
            <LogOut className="size-4" aria-hidden />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
