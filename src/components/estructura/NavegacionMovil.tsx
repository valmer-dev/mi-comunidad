"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Megaphone, Settings, ShieldCheck, Users, Wrench } from "lucide-react";
import { cn } from "@/lib/utilidades";

const ENLACES = [
  { href: "/panel", etiqueta: "Panel", icono: LayoutDashboard },
  { href: "/tablon", etiqueta: "Tablón", icono: Megaphone },
  { href: "/incidencias", etiqueta: "Avisos", icono: Wrench },
  { href: "/vecinos", etiqueta: "Vecinos", icono: Users },
  { href: "/ajustes", etiqueta: "Ajustes", icono: Settings },
];

const ENLACE_PLATAFORMA = { href: "/plataforma", etiqueta: "Plataforma", icono: ShieldCheck };

export function NavegacionMovil({ esAdminPlataforma = false }: { esAdminPlataforma?: boolean }) {
  const ruta = usePathname();
  const enlaces = esAdminPlataforma ? [...ENLACES, ENLACE_PLATAFORMA] : ENLACES;

  return (
    <nav
      className="no-imprimir fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-superficie/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegación principal"
    >
      <ul
        className={cn(
          "mx-auto grid max-w-md",
          enlaces.length > 5 ? "grid-cols-6" : "grid-cols-5",
        )}
      >
        {enlaces.map(({ href, etiqueta, icono: Icono }) => {
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
      </ul>
    </nav>
  );
}
