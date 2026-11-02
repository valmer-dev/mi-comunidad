"use client";

import { useActionState } from "react";
import { Home, Loader2, Save } from "lucide-react";
import { configurarFincas, type EstadoFincas } from "@/app/acciones/comunidad";

const ESTADO_INICIAL: EstadoFincas = {};

type Props = {
  numeroCasas: number;
  numeroPisos: number;
  totalFincas: number;
};

export function ConfigurarFincas({
  numeroCasas,
  numeroPisos,
  totalFincas,
}: Props) {
  const [estado, accion, pendiente] = useActionState(configurarFincas, ESTADO_INICIAL);

  return (
    <section className="tarjeta">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <Home className="size-4.5 text-principal" aria-hidden />
        Casas y pisos
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-suave">
        Indica cuántas casas y pisos tiene la comunidad. Se crean automáticamente con
        su número (Casa 1, 1ºA, 1ºB…).
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl bg-fondo px-3 py-2.5">
          <dt className="text-xs text-suave">Casas</dt>
          <dd className="text-lg font-bold tabular-nums">{numeroCasas}</dd>
        </div>
        <div className="rounded-xl bg-fondo px-3 py-2.5">
          <dt className="text-xs text-suave">Pisos</dt>
          <dd className="text-lg font-bold tabular-nums">{numeroPisos}</dd>
        </div>
      </dl>

      <form action={accion} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="numeroCasas" className="etiqueta">
            Número de casas
          </label>
          <input
            id="numeroCasas"
            name="numeroCasas"
            type="number"
            inputMode="numeric"
            min={0}
            max={500}
            required
            defaultValue={numeroCasas}
            className="campo"
          />
        </div>

        <div>
          <label htmlFor="numeroPisos" className="etiqueta">
            Número de pisos
          </label>
          <input
            id="numeroPisos"
            name="numeroPisos"
            type="number"
            inputMode="numeric"
            min={0}
            max={500}
            required
            defaultValue={numeroPisos}
            className="campo"
          />
        </div>

        <p className="rounded-xl bg-fondo px-3.5 py-2.5 text-xs leading-relaxed text-suave sm:col-span-2">
          Ahora hay {totalFincas} fincas. Si reduces el número, solo se eliminarán las
          que no tengan ningún titular asignado.
        </p>

        {"error" in estado && estado.error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700 sm:col-span-2">
            {estado.error}
          </p>
        )}
        {"ok" in estado && estado.ok && (
          <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800 sm:col-span-2">
            {estado.mensaje}
          </p>
        )}

        <button type="submit" disabled={pendiente} className="boton boton-principal sm:col-span-2">
          {pendiente ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {pendiente ? "Guardando…" : "Guardar casas y pisos"}
        </button>
      </form>
    </section>
  );
}
