import Link from "next/link";
import { Bell, Building2 } from "lucide-react";
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
  notificacionesSinLeer: number;
};

export function Estructura({
  children,
  nombreComunidad,
  nombreUsuario,
  etiquetaRol,
  esAdmin,
  puedeVerFinanzas,
  esAdminPlataforma,
  notificacionesSinLeer,
}: Props) {
  return (
    <div className="min-h-dvh lg:flex">
      <BarraLateral
        nombreComunidad={nombreComunidad}
        nombreUsuario={nombreUsuario}
        etiquetaRol={etiquetaRol}
        puedeVerFinanzas={puedeVerFinanzas}
        esAdminPlataforma={esAdminPlataforma}
        notificacionesSinLeer={notificacionesSinLeer}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="no-imprimir sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-borde/80 bg-fondo/80 px-4 py-3 backdrop-blur-xl lg:hidden"
          style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
        >
          <Link href="/panel" className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-marca to-marca-oscuro text-white shadow-suave">
              <Building2 className="size-4.5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-titulo text-[15px] font-semibold leading-tight">
                {nombreComunidad}
              </span>
              <span className="block text-xs text-suave">{etiquetaRol}</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {esAdmin && (
              <span className="chip hidden bg-principal/10 text-principal-oscuro sm:inline-flex">
                Administración
              </span>
            )}
            <Link
              href="/notificaciones"
              aria-label={
                notificacionesSinLeer > 0
                  ? `Notificaciones: ${notificacionesSinLeer} sin leer`
                  : "Notificaciones"
              }
              className="relative grid size-11 shrink-0 place-items-center rounded-full text-suave hover:text-tinta"
            >
              <Bell className="size-5" aria-hidden />
              {notificacionesSinLeer > 0 && (
                <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-peligro px-1 text-[11px] font-bold leading-5 text-white">
                  {notificacionesSinLeer > 99 ? "99+" : notificacionesSinLeer}
                </span>
              )}
            </Link>
            <Link
              href="/ajustes"
              aria-label={`Tu cuenta: ${nombreUsuario}`}
              className="grid size-11 shrink-0 place-items-center rounded-full"
            >
              <span className="grid size-9 place-items-center rounded-full bg-principal-claro text-xs font-bold text-principal-oscuro ring-2 ring-superficie">
                {iniciales(nombreUsuario)}
              </span>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 pt-5 sm:px-6 lg:px-10 lg:pb-14 lg:pt-10">
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
