"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FileUp, Loader2, Upload, X } from "lucide-react";
import { subirDocumento, type EstadoDocumento } from "@/app/acciones/documentos";
import {
  CATEGORIAS_DOCUMENTOS,
  type CategoriaDocumento,
  DESCRIPCION_CATEGORIA,
  esCategoriaDocumento,
  TAMANO_MAXIMO_DOCUMENTO,
} from "@/lib/documentos";

const ESTADO_INICIAL: EstadoDocumento = {};

export function SubirDocumento() {
  const [abierto, setAbierto] = useState(false);
  const [categoria, setCategoria] = useState<CategoriaDocumento>("Estatutos");
  const [estado, accion, pendiente] = useActionState(subirDocumento, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) formulario.current?.reset();
  }, [estado]);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="boton boton-principal">
        <Upload className="size-4" aria-hidden />
        Subir documento
      </button>
    );
  }

  return (
    <div className="tarjeta w-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <FileUp className="size-4.5 text-principal" aria-hidden />
            Subir documento
          </h2>
          <p className="mt-0.5 text-sm text-suave">Solo archivos PDF, hasta 25 MB.</p>
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
          <label htmlFor="archivo" className="etiqueta">
            Archivo PDF
          </label>
          <input
            id="archivo"
            name="archivo"
            type="file"
            required
            accept="application/pdf,.pdf"
            className="campo file:mr-3 file:rounded-lg file:border-0 file:bg-principal/10 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-principal"
          />
          <p className="mt-1 text-xs text-suave">
            Máximo {TAMANO_MAXIMO_DOCUMENTO / 1024 / 1024} MB por documento.
          </p>
        </div>

        <div>
          <label htmlFor="categoria" className="etiqueta">
            Categoría
          </label>
          <select
            id="categoria"
            name="categoria"
            className="campo"
            value={categoria}
            onChange={(evento) => {
              if (esCategoriaDocumento(evento.target.value)) {
                setCategoria(evento.target.value);
              }
            }}
          >
            {CATEGORIAS_DOCUMENTOS.map((opcion) => (
              <option key={opcion} value={opcion}>
                {opcion}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-suave">{DESCRIPCION_CATEGORIA[categoria]}</p>
        </div>

        <div>
          <label htmlFor="nombre" className="etiqueta">
            Nombre (opcional)
          </label>
          <input
            id="nombre"
            name="nombre"
            className="campo"
            placeholder="Si lo dejas vacío, se usa el del archivo"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="descripcion" className="etiqueta">
            Descripción (opcional)
          </label>
          <input
            id="descripcion"
            name="descripcion"
            className="campo"
            placeholder="Por ejemplo: presupuesto de la reforma del portal"
          />
        </div>

        {estado.error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700 sm:col-span-2">
            {estado.error}
          </p>
        )}
        {estado.ok && (
          <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800 sm:col-span-2">
            {estado.mensaje ?? "Documento subido."}
          </p>
        )}

        <div className="sm:col-span-2">
          <button type="submit" disabled={pendiente} className="boton boton-principal">
            {pendiente ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            {pendiente ? "Subiendo…" : "Subir PDF"}
          </button>
        </div>
      </form>
    </div>
  );
}
