"use client";

import { useActionState, useState } from "react";
import { Check, Landmark, Loader2, Pencil, X } from "lucide-react";
import { guardarSaldoInicial, type EstadoTesoreria } from "@/app/acciones/tesoreria";
import { cn, formatoFechaCorta, formatoMoneda } from "@/lib/utilidades";

const ESTADO_INICIAL: EstadoTesoreria = {};

/** Saldo en cuenta calculado, con el saldo inicial editable. */
export function TarjetaSaldo({
  saldo,
  saldoInicial,
  fechaInicial,
  hoy,
  puedeEditar,
  className,
}: {
  saldo: number;
  saldoInicial: number;
  fechaInicial: string | null;
  hoy: string;
  puedeEditar: boolean;
  className?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, accion, pendiente] = useActionState(
    async (anterior: EstadoTesoreria, datos: FormData) => {
      const resultado = await guardarSaldoInicial(anterior, datos);
      if (resultado.ok) setEditando(false);
      return resultado.ok ? ESTADO_INICIAL : resultado;
    },
    ESTADO_INICIAL,
  );

  return (
    <div className={cn("tarjeta p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="icono-seccion bg-principal-claro text-principal">
          <Landmark className="size-[18px]" aria-hidden />
        </span>
        {puedeEditar && !editando && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="grid size-11 place-items-center rounded-full text-suave hover:bg-hundido hover:text-tinta"
            aria-label="Ajustar saldo inicial"
            title="Ajustar saldo inicial"
          >
            <Pencil className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-suave">Saldo en cuenta</p>
      <p
        className={cn(
          "font-titulo text-xl font-semibold tabular-nums",
          saldo < 0 && "text-peligro",
        )}
      >
        {formatoMoneda(saldo)}
      </p>
      <p className="mt-0.5 text-xs text-suave">
        {fechaInicial
          ? `Desde ${formatoMoneda(saldoInicial)} el ${formatoFechaCorta(fechaInicial)}`
          : "Sin saldo inicial: indica el del banco"}
      </p>

      {editando && (
        <form action={accion} className="mt-3 grid gap-2 border-t border-borde pt-3">
          <p className="text-xs text-suave">
            Pon el saldo que tenía el banco en una fecha. A partir de ahí la app suma los
            cobros e ingresos y resta los gastos.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="saldo" className="etiqueta">
                Saldo (€)
              </label>
              <input
                id="saldo"
                name="saldo"
                inputMode="decimal"
                required
                defaultValue={String(saldoInicial).replace(".", ",")}
                className="campo px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="fechaSaldo" className="etiqueta">
                Fecha
              </label>
              <input
                id="fechaSaldo"
                name="fecha"
                type="date"
                required
                max={hoy}
                defaultValue={fechaInicial ?? hoy}
                className="campo px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          {estado.error && <p className="text-xs text-peligro">{estado.error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pendiente} className="boton boton-principal flex-1 px-2.5 py-1.5 text-sm">
              {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="boton boton-borde px-2.5 py-1.5"
              aria-label="Cancelar"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
