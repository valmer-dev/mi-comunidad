"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, Loader2, X } from "lucide-react";
import { crearJunta, type EstadoJunta } from "@/app/acciones/juntas";

const ESTADO_INICIAL: EstadoJunta = {};

export function NuevaJunta() {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(
    async (anterior: EstadoJunta, datos: FormData) => {
      const resultado = await crearJunta(anterior, datos);
      if (resultado.ok) setAbierto(false);
      return resultado.ok ? ESTADO_INICIAL : resultado;
    },
    ESTADO_INICIAL,
  );

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="boton boton-principal">
        <CalendarPlus className="size-4" aria-hidden />
        Convocar junta
      </button>
    );
  }

  return (
    <div className="tarjeta w-full">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarPlus className="size-4.5 text-principal" aria-hidden />
          Nueva convocatoria
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

      <form action={accion} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="titulo" className="etiqueta">
            Título
          </label>
          <input
            id="titulo"
            name="titulo"
            required
            className="campo"
            placeholder="Junta ordinaria 2026"
          />
        </div>

        <div>
          <label htmlFor="tipo" className="etiqueta">
            Tipo
          </label>
          <select id="tipo" name="tipo" className="campo" defaultValue="ordinaria">
            <option value="ordinaria">Ordinaria</option>
            <option value="extraordinaria">Extraordinaria</option>
          </select>
        </div>

        <div>
          <label htmlFor="fecha" className="etiqueta">
            Fecha y hora
          </label>
          <input
            id="fecha"
            name="fecha"
            type="datetime-local"
            required
            className="campo"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="lugar" className="etiqueta">
            Lugar (opcional)
          </label>
          <input
            id="lugar"
            name="lugar"
            className="campo"
            placeholder="Portal, salón comunitario…"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="puntos" className="etiqueta">
            Puntos del día (uno por línea)
          </label>
          <textarea
            id="puntos"
            name="puntos"
            rows={5}
            className="campo resize-y"
            placeholder={"Aprobación del acta anterior\nPresupuesto 2027\nObras en la fachada"}
          />
        </div>

        {estado.error && (
          <p className="aviso aviso-error sm:col-span-2">
            {estado.error}
          </p>
        )}

        <div className="sm:col-span-2">
          <button type="submit" disabled={pendiente} className="boton boton-principal">
            {pendiente ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <CalendarPlus className="size-4" aria-hidden />
            )}
            {pendiente ? "Convocando…" : "Convocar"}
          </button>
        </div>
      </form>
    </div>
  );
}
