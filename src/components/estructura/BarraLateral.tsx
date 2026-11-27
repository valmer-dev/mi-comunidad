"use client";

import Link from "next/link";
import {
  Briefcase,
  Building2,
  FolderOpen,
  Gavel,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { cerrarSesion } from "@/app/acciones/autenticacion";
import { iniciales } from "@/lib/utilidades";
import { EnlaceLateral } from "./EnlaceLateral";

type Props = {
  nombreComunidad: string;
  nombreUsuario: string;
  etiquetaRol: string;
  puedeVerFinanzas: boolean;
  esAdminPlataforma: boolean;
};

export function BarraLateral({
  nombreComunidad,
  nombreUsuario,
  etiquetaRol,
  puedeVerFinanzas,
  esAdminPlataforma,
}: Props) {
  const enlaces = [
    { href: "/panel", etiqueta: "Panel", icono: LayoutDashboard },
    { href: "/tablon", etiqueta: "Tablón", icono: Megaphone },
    { href: "/incidencias", etiqueta: "Incidencias", icono: Wrench },
    { href: "/servicios", etiqueta: "Servicios", icono: Briefcase },
    { href: "/vecinos", etiqueta: "Vecinos", icono: Users },
    ...(puedeVerFinanzas
      ? [{ href: "/finanzas", etiqueta: "Finanzas", icono: Wallet }]
      : []),
    { href: "/juntas", etiqueta: "Juntas", icono: Gavel },
    { href: "/documentos", etiqueta: "Documentos", icono: FolderOpen },
    ...(esAdminPlataforma
      ? [{ href: "/plataforma", etiqueta: "Plataforma", icono: ShieldCheck }]
      : []),
    { href: "/ajustes", etiqueta: "Ajustes", icono: Settings },
  ];

  return (
    <aside className="no-imprimir sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-borde bg-superficie px-3 py-6 lg:flex">
      <Link href="/panel" className="flex items-center gap-3 px-3">
        <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-marca to-marca-oscuro text-white shadow-elevada">
          <Building2 className="size-5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block font-titulo text-[15px] font-semibold leading-tight text-tinta">
            Mi Comunidad
          </span>
          <span className="block truncate text-xs text-suave">{nombreComunidad}</span>
        </span>
      </Link>

      <nav className="mt-8 flex flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Navegación principal">
        {enlaces.map((enlace) => (
          <EnlaceLateral key={enlace.href} {...enlace} />
        ))}
      </nav>

      <div className="mt-4 rounded-2xl border border-borde bg-hundido/60 p-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-principal-claro text-sm font-bold text-principal-oscuro">
            {iniciales(nombreUsuario)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-tinta">
              {nombreUsuario}
            </span>
            <span className="block truncate text-xs text-suave">
              {etiquetaRol}
            </span>
          </span>
        </div>
        <form action={cerrarSesion} className="mt-3">
          <button
            type="submit"
            className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2 py-2 text-sm font-medium text-suave transition-colors hover:bg-superficie hover:text-peligro"
          >
            <LogOut className="size-4" aria-hidden />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
