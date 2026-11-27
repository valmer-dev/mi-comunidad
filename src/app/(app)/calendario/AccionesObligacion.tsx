"use client";

import { useActionState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  completarObligacion,
  eliminarObligacion,
  type EstadoObligacion,
} from "@/app/acciones/obligaciones";
import { BotonEliminar } from "@/components/ui/BotonEliminar";

const ESTADO_INICIAL: EstadoObligacion = {};

export function AccionesObligacion({ id, titulo, repite }: { id: string; titulo: string; repite: boolean }) {
  const [estado, accion, pendiente] = useActionState(completarObligacion, ESTADO_INICIAL);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <form action={accion}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={pendiente} className="boton boton-borde px-3 py-1.5 text-xs">
            {pendiente ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
            Hecho
          </button>
        </form>
        <BotonEliminar
          accion={eliminarObligacion}
          id={id}
          etiqueta="Quitar"
          titulo="Quitar del calendario"
          mensaje={`¿Quitar «${titulo}» del calendario${repite ? " y sus próximas repeticiones" : ""}?`}
        />
      </div>
      {estado.error && <p className="text-xs text-peligro">{estado.error}</p>}
      {estado.ok && estado.mensaje && <p className="text-xs text-exito">{estado.mensaje}</p>}
    </div>
  );
}
