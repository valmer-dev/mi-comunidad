import Link from "next/link";
import { Building2 } from "lucide-react";
import { BarraLateral } from "./BarraLateral";
import { NavegacionMovil } from "./NavegacionMovil";
import { iniciales } from "@/lib/utilidades";

type Props = {
  children: React.ReactNode;
  nombreComunidad: string;
  nombreUsuario: string;
  etiquetaRol: string;
  esAdmin: boolean;
  puedeVerFinanzas: boolean;
  esAdminPlataforma: boolean;
};

export function Estructura({
  children,
  nombreComunidad,
  nombreUsuario,
  etiquetaRol,
  esAdmin,
  puedeVerFinanzas,
  esAdminPlataforma,
}: Props) {
  return (
    <div className="min-h-dvh lg:flex">
      <BarraLateral
        nombreComunidad={nombreComunidad}
        nombreUsuario={nombreUsuario}
        etiquetaRol={etiquetaRol}
        puedeVerFinanzas={puedeVerFinanzas}
        esAdminPlataforma={esAdminPlataforma}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-imprimir sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-borde bg-fondo/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/panel" className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-principal text-white">
              <Building2 className="size-4.5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold leading-tight">
                {nombreComunidad}
              </span>
              <span className="block text-[11px] text-suave">{etiquetaRol}</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {esAdmin && (
              <span className="chip hidden bg-principal/10 text-principal-oscuro sm:inline-flex">
                Administración
              </span>
            )}
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-principal-claro text-xs font-bold text-principal-oscuro">
              {iniciales(nombreUsuario)}
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-14 lg:pt-9">
          {children}
        </main>
      </div>

      <NavegacionMovil
        esAdminPlataforma={esAdminPlataforma}
        puedeVerFinanzas={puedeVerFinanzas}
      />
    </div>
  );
}
