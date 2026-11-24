import type { LucideIcon } from "lucide-react";

export function CabeceraPagina({
  titulo,
  descripcion,
  accion,
  icono: Icono,
}: {
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
  icono?: LucideIcon;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 lg:mb-8">
      <div className="flex min-w-0 items-center gap-3.5">
        {Icono && (
          <span className="icono-seccion size-11 bg-principal/10 text-principal sm:size-12">
            <Icono className="size-[22px] sm:size-6" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{titulo}</h1>
          {descripcion && <p className="mt-0.5 text-[15px] text-suave">{descripcion}</p>}
        </div>
      </div>
      {accion}
    </div>
  );
}

export function EstadoVacio({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-borde-fuerte bg-superficie/60 px-6 py-12 text-center">
      <p className="font-titulo text-base font-semibold">{titulo}</p>
      {descripcion && <p className="mt-1.5 max-w-sm text-[15px] text-suave">{descripcion}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  );
}
