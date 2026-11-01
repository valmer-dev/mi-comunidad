"use client";

import { useActionState, useState } from "react";
import { Loader2, Megaphone, Plus, X } from "lucide-react";
import { publicarAnuncio, type EstadoAnuncio } from "@/app/acciones/tablon";

const ESTADO_INICIAL: EstadoAnuncio = {};

export function NuevoAnuncio() {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(publicarAnuncio, ESTADO_INICIAL);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="boton boton-principal">
        <Plus className="size-4" aria-hidden />
        Publicar anuncio
      </button>
    );
  }

  return (
    <div className="tarjeta w-full">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Megaphone className="size-4.5 text-principal" aria-hidden />
          Nuevo anuncio
        </h2>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-lg p-1.5 text-suave hover:bg-fondo"
          aria-label="Cerrar"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <form action={accion} className="mt-4 space-y-4">
        <div>
          <label htmlFor="titulo" className="etiqueta">
            Título
          </label>
          <input
            id="titulo"
            name="titulo"
            required
            className="campo"
            placeholder="Corte de agua el martes"
          />
        </div>

        <div>
          <label htmlFor="contenido" className="etiqueta">
            Contenido
          </label>
          <textarea
            id="contenido"
            name="contenido"
            required
            rows={5}
            className="campo resize-y"
            placeholder="Escribe aquí el anuncio para los vecinos…"
          />
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="fijado" className="size-4 accent-principal" />
          Fijar en la parte superior del tablón
        </label>

        {estado.error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
            {estado.error}
          </p>
        )}
        {estado.ok && (
          <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800">
            Anuncio publicado.
          </p>
        )}

        <button type="submit" disabled={pendiente} className="boton boton-principal">
          {pendiente ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Megaphone className="size-4" aria-hidden />
          )}
          {pendiente ? "Publicando…" : "Publicar"}
        </button>
      </form>
    </div>
  );
}
