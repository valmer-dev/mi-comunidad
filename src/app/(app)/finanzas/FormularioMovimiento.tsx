"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import {
  crearIngreso,
  crearMovimientoFondo,
  type EstadoTesoreria,
} from "@/app/acciones/tesoreria";

const ESTADO_INICIAL: EstadoTesoreria = {};

/**
 * Formulario desplegable para un ingreso o un movimiento del fondo de
 * reserva. En el fondo se elige si se aporta (dotacion) o se retira
 * (disposicion).
 */
export function FormularioMovimiento({
  tipo,
  hoy,
}: {
  tipo: "ingreso" | "fondo";
  hoy: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(
    async (anterior: EstadoTesoreria, datos: FormData) => {
      const resultado =
        tipo === "ingreso"
          ? await crearIngreso(anterior, datos)
          : await crearMovimientoFondo(anterior, datos);
      if (resultado.ok) setAbierto(false);
      return resultado.ok ? ESTADO_INICIAL : resultado;
    },
    ESTADO_INICIAL,
  );

  const sufijo = tipo;

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="boton boton-borde px-3 py-1.5 text-sm">
        <Plus className="size-4" aria-hidden />
        {tipo === "ingreso" ? "Registrar ingreso" : "Movimiento del fondo"}
      </button>
    );
  }

  return (
    <form action={accion} className="tarjeta mt-3 grid w-full gap-3 p-4 sm:grid-cols-2">
      <div className="flex items-center justify-between sm:col-span-2">
        <h3 className="text-sm font-bold">
          {tipo === "ingreso" ? "Nuevo ingreso" : "Movimiento del fondo de reserva"}
        </h3>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="grid size-9 place-items-center rounded-full text-suave hover:bg-hundido"
          aria-label="Cerrar"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {tipo === "fondo" && (
        <fieldset className="sm:col-span-2">
          <legend className="etiqueta">Tipo</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="tipo" value="dotacion" defaultChecked className="accent-principal" />
              Aportar al fondo
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="tipo" value="disposicion" className="accent-principal" />
              Retirar del fondo
            </label>
          </div>
        </fieldset>
      )}

      <div className="sm:col-span-2">
        <label htmlFor={`concepto_${sufijo}`} className="etiqueta">
          Concepto
        </label>
        <input
          id={`concepto_${sufijo}`}
          name="concepto"
          required
          className="campo"
          placeholder={
            tipo === "ingreso" ? "Alquiler de la azotea" : "Dotación anual aprobada en junta"
          }
        />
      </div>
      <div>
        <label htmlFor={`importe_${sufijo}`} className="etiqueta">
          Importe (€)
        </label>
        <input id={`importe_${sufijo}`} name="importe" inputMode="decimal" required className="campo" />
      </div>
      <div>
        <label htmlFor={`fecha_${sufijo}`} className="etiqueta">
          Fecha
        </label>
        <input
          id={`fecha_${sufijo}`}
          name="fecha"
          type="date"
          required
          defaultValue={hoy}
          className="campo"
        />
      </div>

      {estado.error && <p className="aviso aviso-error sm:col-span-2">{estado.error}</p>}

      <button type="submit" disabled={pendiente} className="boton boton-principal sm:col-span-2">
        {pendiente && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Guardar
      </button>
    </form>
  );
}
