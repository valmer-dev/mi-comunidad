"use client";

import { useActionState, useState } from "react";
import { FilePlus2, Loader2, Plus, X } from "lucide-react";
import { generarRecibos, type EstadoRecibos } from "@/app/acciones/recibos";

const ESTADO_INICIAL: EstadoRecibos = {};

export function GenerarRecibos({
  mesInicial,
  importeInicial,
  fincasConCoeficiente,
}: {
  mesInicial: string;
  importeInicial: number;
  fincasConCoeficiente: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(generarRecibos, ESTADO_INICIAL);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="boton boton-principal">
        <Plus className="size-4" aria-hidden />
        Generar recibos
      </button>
    );
  }

  return (
    <div className="tarjeta w-full">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FilePlus2 className="size-4.5 text-principal" aria-hidden />
          Generar recibos del mes
        </h2>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="grid size-11 place-items-center rounded-full text-suave hover:bg-hundido hover:text-tinta"
          aria-label="Cerrar"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-suave">
        Escribe lo que paga toda la comunidad y la app lo reparte entre las{" "}
        {fincasConCoeficiente} fincas según su coeficiente. Si una vivienda ya tiene
        un recibo con el mismo mes y concepto, no se duplica.
      </p>

      <form action={accion} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="mes" className="etiqueta">
            Mes
          </label>
          <input id="mes" name="mes" type="month" required defaultValue={mesInicial} className="campo" />
        </div>

        <div>
          <label htmlFor="importeTotal" className="etiqueta">
            Importe total (€)
          </label>
          <input
            id="importeTotal"
            name="importeTotal"
            inputMode="decimal"
            required
            defaultValue={importeInicial > 0 ? String(importeInicial).replace(".", ",") : ""}
            placeholder="1200,00"
            className="campo"
          />
          <p className="mt-1 text-xs text-suave">Por defecto, la cuota mensual de Finanzas.</p>
        </div>

        <div>
          <label htmlFor="concepto" className="etiqueta">
            Concepto
          </label>
          <input
            id="concepto"
            name="concepto"
            required
            defaultValue="Cuota ordinaria"
            className="campo"
          />
        </div>

        <div>
          <label htmlFor="venceEn" className="etiqueta">
            Vence el (opcional)
          </label>
          <input id="venceEn" name="venceEn" type="date" className="campo" />
          <p className="mt-1 text-xs text-suave">Si lo dejas vacío, vence a fin de mes.</p>
        </div>

        {estado.error && <p className="aviso aviso-error sm:col-span-2">{estado.error}</p>}
        {estado.ok && estado.mensaje && (
          <p className="aviso aviso-exito sm:col-span-2">{estado.mensaje}</p>
        )}

        <button type="submit" disabled={pendiente} className="boton boton-principal sm:col-span-2">
          {pendiente ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <FilePlus2 className="size-4" aria-hidden />
          )}
          {pendiente ? "Generando…" : "Generar recibos"}
        </button>
      </form>
    </div>
  );
}
