"use client";

import { useActionState, useEffect, useState } from "react";
import { Briefcase, Loader2, Pencil, Phone, Save, X } from "lucide-react";
import {
  actualizarServicio,
  eliminarServicio,
  type EstadoServicio,
} from "@/app/acciones/servicios";
import { BotonEliminar } from "@/components/ui/BotonEliminar";

export type Servicio = {
  id: string;
  nombre: string;
  categoria: string | null;
  telefono: string | null;
};

const ESTADO_INICIAL: EstadoServicio = {};

function enlaceTelefono(telefono: string) {
  return `tel:${telefono.replace(/[^\d+]/g, "")}`;
}

function FormularioEditar({
  servicio,
  alCerrar,
}: {
  servicio: Servicio;
  alCerrar: () => void;
}) {
  const [estado, accion, pendiente] = useActionState(
    actualizarServicio,
    ESTADO_INICIAL,
  );

  useEffect(() => {
    if (estado.ok) alCerrar();
  }, [estado, alCerrar]);

  return (
    <form action={accion}>
      <input type="hidden" name="id" value={servicio.id} />
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Pencil className="size-4.5 text-principal" aria-hidden />
          Editar servicio
        </h2>
        <button
          type="button"
          onClick={alCerrar}
          className="rounded-lg p-1.5 text-suave hover:bg-fondo"
          aria-label="Cerrar"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`servicio-${servicio.id}`} className="etiqueta">
            Servicio
          </label>
          <input
            id={`servicio-${servicio.id}`}
            name="servicio"
            required
            defaultValue={servicio.categoria ?? ""}
            className="campo"
          />
        </div>

        <div>
          <label htmlFor={`empresa-${servicio.id}`} className="etiqueta">
            Empresa
          </label>
          <input
            id={`empresa-${servicio.id}`}
            name="empresa"
            required
            defaultValue={servicio.nombre}
            className="campo"
          />
        </div>

        <div>
          <label htmlFor={`telefono-${servicio.id}`} className="etiqueta">
            Teléfono de contacto
          </label>
          <input
            id={`telefono-${servicio.id}`}
            name="telefono"
            type="tel"
            required
            defaultValue={servicio.telefono ?? ""}
            className="campo"
          />
        </div>

        {estado.error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700 sm:col-span-2">
            {estado.error}
          </p>
        )}

        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" disabled={pendiente} className="boton boton-principal">
            {pendiente ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            {pendiente ? "Guardando…" : "Guardar cambios"}
          </button>
          <button type="button" onClick={alCerrar} className="boton boton-borde">
            <X className="size-4" aria-hidden />
            Cancelar
          </button>
        </div>
      </div>
    </form>
  );
}

export function ServicioItem({
  servicio,
  puedeGestionar,
}: {
  servicio: Servicio;
  puedeGestionar: boolean;
}) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <li className="tarjeta">
        <FormularioEditar servicio={servicio} alCerrar={() => setEditando(false)} />
      </li>
    );
  }

  return (
    <li className="tarjeta">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-principal/10 text-principal">
            <Briefcase className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-snug">
              {servicio.categoria || "Servicio sin especificar"}
            </h2>
            <p className="mt-0.5 text-sm font-medium text-tinta/90">{servicio.nombre}</p>
            {servicio.telefono ? (
              <a
                href={enlaceTelefono(servicio.telefono)}
                className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-principal hover:underline"
              >
                <Phone className="size-3.5" aria-hidden />
                {servicio.telefono}
              </a>
            ) : (
              <p className="mt-1.5 text-sm text-suave">Sin teléfono de contacto</p>
            )}
          </div>
        </div>

        {puedeGestionar && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="boton boton-borde px-3 py-1.5 text-xs"
            >
              <Pencil className="size-3.5" aria-hidden />
              Editar
            </button>
            <BotonEliminar
              accion={eliminarServicio}
              id={servicio.id}
              etiqueta="Eliminar"
              titulo="Eliminar servicio"
              mensaje={`¿Eliminar el servicio «${servicio.categoria ?? servicio.nombre}» de ${servicio.nombre}?`}
            />
          </div>
        )}
      </div>
    </li>
  );
}
