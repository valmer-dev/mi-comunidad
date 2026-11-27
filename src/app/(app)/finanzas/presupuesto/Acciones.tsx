"use client";

import { CheckCircle2, Lock, Printer, RotateCcw, Trash2, Wallet } from "lucide-react";
import {
  aplicarCuotaPresupuesto,
  cambiarEstadoPresupuesto,
  crearPresupuesto,
  eliminarPresupuesto,
} from "@/app/acciones/presupuestos";
import { formatoMoneda } from "@/lib/utilidades";
import { BotonEnviar, FormularioAccion } from "./FormularioAccion";

/** Crear el presupuesto de un ejercicio: vacio, copiando el anterior o desde lo gastado. */
export function CrearPresupuesto({
  ejercicio,
  hayAnterior,
}: {
  ejercicio: number;
  hayAnterior: boolean;
}) {
  return (
    <FormularioAccion accion={crearPresupuesto} ocultos={{ ejercicio: String(ejercicio) }} className="mt-4 grid gap-3">
      <fieldset>
        <legend className="etiqueta">¿Cómo empezamos?</legend>
        <div className="grid gap-2 text-sm">
          <label className="flex items-start gap-2">
            <input type="radio" name="origen" value="reales" defaultChecked className="mt-1 accent-principal" />
            <span>
              Con lo gastado en {ejercicio - 1}
              <span className="block text-xs text-suave">Una partida por cada categoría de gasto.</span>
            </span>
          </label>
          {hayAnterior && (
            <label className="flex items-start gap-2">
              <input type="radio" name="origen" value="copiar" className="mt-1 accent-principal" />
              <span>Copiando el presupuesto de {ejercicio - 1}</span>
            </label>
          )}
          <label className="flex items-start gap-2">
            <input type="radio" name="origen" value="vacio" className="mt-1 accent-principal" />
            <span>En blanco</span>
          </label>
        </div>
      </fieldset>
      <BotonEnviar className="boton-principal">Crear presupuesto de {ejercicio}</BotonEnviar>
    </FormularioAccion>
  );
}

export function AccionesPresupuesto({
  id,
  estado,
  cuotaResultante,
  cuotaActual,
  hoy,
}: {
  id: string;
  estado: string;
  cuotaResultante: number;
  cuotaActual: number;
  hoy: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      {estado === "borrador" && (
        <FormularioAccion
          accion={cambiarEstadoPresupuesto}
          ocultos={{ id, estado: "aprobado" }}
          className="flex flex-wrap items-end gap-2"
        >
          <div>
            <label htmlFor="aprobadoEn" className="etiqueta">
              Aprobado en junta el
            </label>
            <input id="aprobadoEn" name="aprobadoEn" type="date" defaultValue={hoy} className="campo py-1.5" />
          </div>
          <BotonEnviar className="boton-principal py-2">
            <CheckCircle2 className="size-4" aria-hidden />
            Marcar aprobado
          </BotonEnviar>
        </FormularioAccion>
      )}

      {estado !== "borrador" && cuotaResultante !== cuotaActual && (
        <FormularioAccion
          accion={aplicarCuotaPresupuesto}
          ocultos={{ id }}
          confirmar={`¿Cambiar la cuota mensual de ${formatoMoneda(cuotaActual)} a ${formatoMoneda(cuotaResultante)}?`}
        >
          <BotonEnviar className="boton-principal py-2">
            <Wallet className="size-4" aria-hidden />
            Usar {formatoMoneda(cuotaResultante)} como cuota mensual
          </BotonEnviar>
        </FormularioAccion>
      )}

      {estado === "aprobado" && (
        <FormularioAccion
          accion={cambiarEstadoPresupuesto}
          ocultos={{ id, estado: "cerrado" }}
          confirmar="¿Cerrar el ejercicio? Las cuentas quedan como liquidación del año."
        >
          <BotonEnviar className="boton-borde py-2">
            <Lock className="size-4" aria-hidden />
            Cerrar ejercicio
          </BotonEnviar>
        </FormularioAccion>
      )}

      {estado !== "borrador" && (
        <FormularioAccion
          accion={cambiarEstadoPresupuesto}
          ocultos={{ id, estado: "borrador" }}
          confirmar="¿Volver a borrador para cambiar las partidas?"
        >
          <BotonEnviar className="boton-borde py-2">
            <RotateCcw className="size-4" aria-hidden />
            Volver a borrador
          </BotonEnviar>
        </FormularioAccion>
      )}

      {estado === "borrador" && (
        <FormularioAccion
          accion={eliminarPresupuesto}
          ocultos={{ id }}
          confirmar="¿Borrar este presupuesto y todas sus partidas?"
        >
          <BotonEnviar className="boton-borde py-2">
            <Trash2 className="size-4" aria-hidden />
            Borrar
          </BotonEnviar>
        </FormularioAccion>
      )}
    </div>
  );
}

export function BotonImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="boton boton-borde px-3 py-1.5 text-sm print:hidden">
      <Printer className="size-4" aria-hidden />
      Imprimir o guardar en PDF
    </button>
  );
}
