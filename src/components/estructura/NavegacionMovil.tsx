"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  CalendarClock,
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

const ENLACES_PRINCIPALES = [
  { href: "/panel", etiqueta: "Panel", icono: LayoutDashboard },
  { href: "/tablon", etiqueta: "Tablón", icono: Megaphone },
  { href: "/incidencias", etiqueta: "Avisos", icono: Wrench },
];

const ENLACES_SECUNDARIOS = [
  { href: "/vecinos", etiqueta: "Vecinos", icono: Users },
  { href: "/documentos", etiqueta: "Documentos", icono: FolderOpen },
  { href: "/juntas", etiqueta: "Juntas", icono: Gavel },
  { href: "/servicios", etiqueta: "Servicios", icono: Briefcase },
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
  // Guardamos la ruta en la que se abrio el menu: si cambia (navegacion,
  // atras/adelante), el menu se considera cerrado sin necesidad de un efecto.
  const [rutaAbierta, setRutaAbierta] = useState<string | null>(null);
  const abierto = rutaAbierta === ruta;

  const enlacesPrincipales = puedeVerFinanzas
    ? [
        ...ENLACES_PRINCIPALES,
        { href: "/finanzas", etiqueta: "Finanzas", icono: Wallet },
      ]
    : ENLACES_PRINCIPALES;

  const enlacesSecundarios = [
    ...ENLACES_SECUNDARIOS,
    ...(puedeVerFinanzas ? [{ href: "/calendario", etiqueta: "Calendario", icono: CalendarClock }] : []),
    { href: "/ajustes", etiqueta: "Ajustes", icono: Settings },
    ...(esAdminPlataforma
      ? [{ href: "/plataforma", etiqueta: "Plataforma", icono: ShieldCheck }]
      : []),
  ];

  const seccionSecundariaActiva = enlacesSecundarios.some(
    (enlace) => ruta === enlace.href || ruta.startsWith(`${enlace.href}/`),
  );

  // Cierra el menu al pulsar Escape.
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setRutaAbierta(null);
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
          onClick={() => setRutaAbierta(null)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] motion-safe:animate-[aparecer_150ms_ease-out] lg:hidden"
        />
      )}

      {abierto && (
        <div
          id="menu-mas"
          role="dialog"
          aria-modal="true"
          aria-label="Más secciones"
          className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-lg rounded-t-3xl border border-b-0 border-borde bg-superficie px-3 pt-2 shadow-flotante motion-safe:animate-[subir-hoja_220ms_cubic-bezier(0.2,0.8,0.2,1)] lg:hidden"
          style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-borde-fuerte" aria-hidden />
          <div className="flex items-center justify-between px-2 pb-2">
            <p className="sobretitulo">Más secciones</p>
            <button
              type="button"
              onClick={() => setRutaAbierta(null)}
              className="grid size-11 place-items-center rounded-full text-suave transition-colors hover:bg-hundido hover:text-tinta"
              aria-label="Cerrar"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <ul className="grid grid-cols-3 gap-2">
            {enlacesSecundarios.map(({ href, etiqueta, icono: Icono }) => {
              const activo = ruta === href || ruta.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setRutaAbierta(null)}
                    className={cn(
                      "flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center text-sm font-medium transition-colors active:scale-[0.98]",
                      activo
                        ? "border-principal/30 bg-principal/10 text-principal-oscuro"
                        : "border-borde bg-hundido/60 text-tinta hover:bg-hundido",
                    )}
                    aria-current={activo ? "page" : undefined}
                  >
                    <Icono className="size-[22px] shrink-0" aria-hidden />
                    {etiqueta}
                  </Link>
                </li>
              );
            })}
          </ul>

          <form action={cerrarSesion} className="mt-3 border-t border-borde pt-2">
            <button
              type="submit"
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-peligro transition-colors hover:bg-peligro-claro"
            >
              <LogOut className="size-[18px] shrink-0" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </div>
      )}

      <nav
        className="no-imprimir fixed inset-x-0 bottom-0 z-50 border-t border-borde bg-superficie/90 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegación móvil"
      >
        <ul
          className={cn(
            "mx-auto grid max-w-lg px-1",
            enlacesPrincipales.length === 4 ? "grid-cols-5" : "grid-cols-4",
          )}
        >
          {enlacesPrincipales.map(({ href, etiqueta, icono: Icono }) => {
            const activo = ruta === href || ruta.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "group flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium transition-colors",
                    activo ? "text-principal-oscuro" : "text-suave hover:text-tinta",
                  )}
                  aria-current={activo ? "page" : undefined}
                >
                  <span
                    className={cn(
                      "grid h-8 w-14 place-items-center rounded-full transition-colors duration-200",
                      activo ? "bg-principal/15" : "group-active:bg-hundido",
                    )}
                  >
                    <Icono className="size-[22px]" strokeWidth={activo ? 2.25 : 1.9} aria-hidden />
                  </span>
                  <span className={activo ? "font-semibold" : undefined}>{etiqueta}</span>
                </Link>
              </li>
            );
          })}

          <li>
            <button
              type="button"
              onClick={() => setRutaAbierta(abierto ? null : ruta)}
              className={cn(
                "group flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium transition-colors",
                abierto || seccionSecundariaActiva ? "text-principal-oscuro" : "text-suave hover:text-tinta",
              )}
              aria-expanded={abierto}
              aria-controls="menu-mas"
            >
              <span
                className={cn(
                  "grid h-8 w-14 place-items-center rounded-full transition-colors duration-200",
                  abierto || seccionSecundariaActiva ? "bg-principal/15" : "group-active:bg-hundido",
                )}
              >
                {abierto ? (
                  <X className="size-[22px]" aria-hidden />
                ) : (
                  <Menu className="size-[22px]" aria-hidden />
                )}
              </span>
              <span className={abierto || seccionSecundariaActiva ? "font-semibold" : undefined}>
                Más
              </span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
