"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  FolderOpen,
  Gavel,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { cerrarSesion } from "@/app/acciones/autenticacion";
import { cn } from "@/lib/utilidades";

const ENLACES = [
  { href: "/panel", etiqueta: "Panel", icono: LayoutDashboard },
  { href: "/tablon", etiqueta: "Tablón", icono: Megaphone },
  { href: "/incidencias", etiqueta: "Avisos", icono: Wrench },
  { href: "/vecinos", etiqueta: "Vecinos", icono: Users },
];

type Props = {
  esAdminPlataforma?: boolean;
  puedeVerFinanzas?: boolean;
};

export function NavegacionMovil({
  esAdminPlataforma = false,
  puedeVerFinanzas = false,
}: Props) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);

  const enlacesSecundarios = [
    { href: "/documentos", etiqueta: "Documentos", icono: FolderOpen },
    { href: "/juntas", etiqueta: "Juntas", icono: Gavel },
    { href: "/servicios", etiqueta: "Servicios", icono: Briefcase },
    ...(puedeVerFinanzas
      ? [{ href: "/finanzas", etiqueta: "Finanzas", icono: Wallet }]
      : []),
    { href: "/ajustes", etiqueta: "Ajustes", icono: Settings },
    ...(esAdminPlataforma
      ? [{ href: "/plataforma", etiqueta: "Plataforma", icono: ShieldCheck }]
      : []),
  ];

  const seccionSecundariaActiva = enlacesSecundarios.some(
    (enlace) => ruta === enlace.href || ruta.startsWith(`${enlace.href}/`),
  );

  // Cierra el menu al cambiar de pagina o al pulsar Escape.
  useEffect(() => {
    setAbierto(false);
  }, [ruta]);

  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [abierto]);

  return (
    <>
      {abierto && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setAbierto(false)}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] lg:hidden"
        />
      )}

      {abierto && (
        <div
          id="menu-mas"
          className="fixed inset-x-0 z-50 mx-auto w-[calc(100%-1.5rem)] max-w-md rounded-2xl border border-borde bg-superficie p-2 shadow-xl lg:hidden"
          style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center justify-between px-3 pb-1 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-suave">
              Más secciones
            </p>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-lg p-1 text-suave hover:bg-fondo"
              aria-label="Cerrar"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <ul className="grid gap-0.5">
            {enlacesSecundarios.map(({ href, etiqueta, icono: Icono }) => {
              const activo = ruta === href || ruta.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setAbierto(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      activo
                        ? "bg-principal/10 text-principal-oscuro"
                        : "text-tinta hover:bg-fondo",
                    )}
                    aria-current={activo ? "page" : undefined}
                  >
                    <Icono className="size-[18px] shrink-0" aria-hidden />
                    {etiqueta}
                  </Link>
                </li>
              );
            })}
          </ul>

          <form action={cerrarSesion} className="mt-1 border-t border-borde pt-1">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-suave transition-colors hover:bg-fondo hover:text-tinta"
            >
              <LogOut className="size-[18px] shrink-0" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </div>
      )}

      <nav
        className="no-imprimir fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-superficie/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegación móvil"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {ENLACES.map(({ href, etiqueta, icono: Icono }) => {
            const activo = ruta === href || ruta.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium transition-colors",
                    activo ? "text-principal" : "text-suave",
                  )}
                  aria-current={activo ? "page" : undefined}
                >
                  <Icono className="size-5" aria-hidden />
                  {etiqueta}
                </Link>
              </li>
            );
          })}

          <li>
            <button
              type="button"
              onClick={() => setAbierto((valor) => !valor)}
              className={cn(
                "flex w-full flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium transition-colors",
                abierto || seccionSecundariaActiva ? "text-principal" : "text-suave",
              )}
              aria-expanded={abierto}
              aria-controls="menu-mas"
            >
              {abierto ? (
                <X className="size-5" aria-hidden />
              ) : (
                <Menu className="size-5" aria-hidden />
              )}
              Más
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
