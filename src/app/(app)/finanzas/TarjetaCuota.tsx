"use client";

import { useActionState, useState } from "react";
import { Check, Loader2, Pencil, Wallet, X } from "lucide-react";
import { actualizarCuotaMensual, type EstadoCuota } from "@/app/acciones/gastos";
import { cn, formatoMoneda } from "@/lib/utilidades";

const ESTADO_INICIAL: EstadoCuota = {};

export function TarjetaCuota({
  cuota,
  puedeEditar,
  className,
}: {
  cuota: number;
  puedeEditar: boolean;
  className?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, accion, pendiente] = useActionState(
    async (anterior: EstadoCuota, datos: FormData) => {
      const resultado = await actualizarCuotaMensual(anterior, datos);
      if (resultado.ok) setEditando(false);
      return resultado;
    },
    ESTADO_INICIAL,
  );

  return (
    <div className={cn("tarjeta p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-blue-100 text-blue-700">
          <Wallet className="size-[18px]" aria-hidden />
        </span>
        {puedeEditar && !editando && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="rounded-lg p-1.5 text-suave hover:bg-fondo"
            aria-label="Editar cuota mensual"
            title="Editar cuota mensual"
          >
            <Pencil className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-suave">Cuota mensual</p>

      {editando ? (
        <form action={accion} className="mt-1 flex items-center gap-1.5">
          <input
            id="cuota"
            name="cuota"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={cuota}
            className="campo min-w-0 px-2 py-1 text-sm"
            aria-label="Cuota mensual"
          />
          <button
            type="submit"
            disabled={pendiente}
            className="boton boton-principal px-2.5 py-1.5"
            aria-label="Guardar cuota"
          >
            {pendiente ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="boton boton-borde px-2.5 py-1.5"
            aria-label="Cancelar"
          >
            <X className="size-4" aria-hidden />
          </button>
        </form>
      ) : (
        <p className="text-xl font-bold">{formatoMoneda(cuota)}</p>
      )}

      {estado.error && (
        <p className="mt-2 text-xs font-medium text-red-700">{estado.error}</p>
      )}

      <p className="mt-0.5 text-xs text-suave">Total mensual de todos los vecinos</p>
    </div>
  );
}
