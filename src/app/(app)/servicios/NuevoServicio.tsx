"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Briefcase, Loader2, Plus, X } from "lucide-react";
import { crearServicio, type EstadoServicio } from "@/app/acciones/servicios";

const ESTADO_INICIAL: EstadoServicio = {};

export function NuevoServicio() {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(crearServicio, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) formulario.current?.reset();
  }, [estado]);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="boton boton-principal">
        <Plus className="size-4" aria-hidden />
        Nuevo servicio
      </button>
    );
  }

  return (
    <div className="tarjeta w-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Briefcase className="size-4.5 text-principal" aria-hidden />
            Nuevo servicio
          </h2>
          <p className="mt-0.5 text-sm text-suave">
            Empresa y teléfono de contacto que verán todos los vecinos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-lg p-1.5 text-suave hover:bg-fondo"
          aria-label="Cerrar"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <form ref={formulario} action={accion} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="servicio" className="etiqueta">
            Servicio
          </label>
          <input
            id="servicio"
            name="servicio"
            required
            className="campo"
            placeholder="Mantenimiento de los ascensores"
          />
        </div>

        <div>
          <label htmlFor="empresa" className="etiqueta">
            Empresa
          </label>
          <input
            id="empresa"
            name="empresa"
            required
            className="campo"
            placeholder="Ascensores García, S.L."
          />
        </div>

        <div>
          <label htmlFor="telefono" className="etiqueta">
            Teléfono de contacto
          </label>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            required
            className="campo"
            placeholder="912 345 678"
          />
        </div>

        {estado.error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700 sm:col-span-2">
            {estado.error}
          </p>
        )}
        {estado.ok && (
          <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800 sm:col-span-2">
            {estado.mensaje ?? "Servicio añadido."}
          </p>
        )}

        <div className="sm:col-span-2">
          <button type="submit" disabled={pendiente} className="boton boton-principal">
            {pendiente ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Briefcase className="size-4" aria-hidden />
            )}
            {pendiente ? "Guardando…" : "Guardar servicio"}
          </button>
        </div>
      </form>
    </div>
  );
}
