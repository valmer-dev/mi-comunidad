"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { eliminarPartida, guardarPartida } from "@/app/acciones/presupuestos";
import { formatoMoneda } from "@/lib/utilidades";
import { BotonEnviar, FormularioAccion } from "./FormularioAccion";

export type Partida = {
  id: string;
  concepto: string;
  tipo: "gasto" | "ingreso";
  categoria_id: string | null;
  importe: number;
};

type Categoria = { id: string; nombre: string };

/** Campos de una partida (nueva o existente). */
function CamposPartida({
  partida,
  categorias,
  sufijo,
}: {
  partida?: Partida;
  categorias: Categoria[];
  sufijo: string;
}) {
  return (
    <div className="grid w-full gap-2 sm:grid-cols-[2fr_1fr_1.4fr_1fr]">
      <div>
        <label htmlFor={`concepto_${sufijo}`} className="etiqueta">
          Concepto
        </label>
        <input
          id={`concepto_${sufijo}`}
          name="concepto"
          required
          defaultValue={partida?.concepto}
          placeholder="Limpieza de zonas comunes"
          className="campo"
        />
      </div>
      <div>
        <label htmlFor={`tipo_${sufijo}`} className="etiqueta">
          Tipo
        </label>
        <select id={`tipo_${sufijo}`} name="tipo" defaultValue={partida?.tipo ?? "gasto"} className="campo">
          <option value="gasto">Gasto</option>
          <option value="ingreso">Ingreso</option>
        </select>
      </div>
      <div>
        <label htmlFor={`categoria_${sufijo}`} className="etiqueta">
          Categoría de gasto
        </label>
        <select
          id={`categoria_${sufijo}`}
          name="categoriaId"
          defaultValue={partida?.categoria_id ?? ""}
          className="campo"
        >
          <option value="">Sin categoría</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`importe_${sufijo}`} className="etiqueta">
          Importe anual (€)
        </label>
        <input
          id={`importe_${sufijo}`}
          name="importe"
          inputMode="decimal"
          required
          defaultValue={partida ? String(partida.importe).replace(".", ",") : ""}
          className="campo"
        />
      </div>
    </div>
  );
}

export function FilaPartida({
  partida,
  categorias,
  presupuestoId,
  editable,
  nombreCategoria,
}: {
  partida: Partida;
  categorias: Categoria[];
  presupuestoId: string;
  editable: boolean;
  nombreCategoria: string | null;
}) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <li className="px-4 py-3">
        <FormularioAccion
          accion={async (anterior, datos) => {
            const resultado = await guardarPartida(anterior, datos);
            if (resultado.ok) setEditando(false);
            return resultado;
          }}
          ocultos={{ presupuestoId, id: partida.id }}
          className="flex flex-wrap items-end gap-2"
        >
          <CamposPartida partida={partida} categorias={categorias} sufijo={partida.id} />
          <BotonEnviar className="boton-principal px-3 py-1.5 text-sm">Guardar</BotonEnviar>
          <button type="button" onClick={() => setEditando(false)} className="boton boton-borde px-3 py-1.5 text-sm">
            <X className="size-4" aria-hidden />
            Cancelar
          </button>
        </FormularioAccion>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{partida.concepto}</p>
        {nombreCategoria && <p className="text-xs text-suave">{nombreCategoria}</p>}
      </div>
      <span className="tabular-nums">{formatoMoneda(partida.importe)}</span>
      {editable && (
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="grid size-9 place-items-center rounded-full text-suave hover:bg-hundido"
            aria-label={`Editar ${partida.concepto}`}
          >
            <Pencil className="size-4" aria-hidden />
          </button>
          <FormularioAccion
            accion={eliminarPartida}
            ocultos={{ id: partida.id }}
            confirmar={`¿Quitar la partida «${partida.concepto}»?`}
          >
            <button
              type="submit"
              className="grid size-9 place-items-center rounded-full text-suave hover:bg-peligro-claro hover:text-peligro"
              aria-label={`Quitar ${partida.concepto}`}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </FormularioAccion>
        </div>
      )}
    </li>
  );
}

export function NuevaPartida({
  categorias,
  presupuestoId,
}: {
  categorias: Categoria[];
  presupuestoId: string;
}) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="boton boton-borde px-3 py-1.5 text-sm">
        <Plus className="size-4" aria-hidden />
        Añadir partida
      </button>
    );
  }

  return (
    <FormularioAccion
      accion={guardarPartida}
      ocultos={{ presupuestoId }}
      reiniciar
      className="tarjeta mt-3 flex w-full flex-wrap items-end gap-2 p-4"
    >
      <CamposPartida categorias={categorias} sufijo="nueva" />
      <BotonEnviar className="boton-principal px-3 py-1.5 text-sm">Añadir</BotonEnviar>
      <button type="button" onClick={() => setAbierto(false)} className="boton boton-borde px-3 py-1.5 text-sm">
        <X className="size-4" aria-hidden />
        Cerrar
      </button>
    </FormularioAccion>
  );
}
