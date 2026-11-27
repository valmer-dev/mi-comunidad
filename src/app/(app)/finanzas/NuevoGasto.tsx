"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus, ReceiptText, X } from "lucide-react";
import { crearGasto, type EstadoGasto } from "@/app/acciones/gastos";

type Categoria = { id: string; nombre: string };
type Opcion = { id: string; nombre: string };

const ESTADO_INICIAL: EstadoGasto = {};

export function NuevoGasto({
  categorias,
  proveedores = [],
  facturas = [],
}: {
  categorias: Categoria[];
  proveedores?: Opcion[];
  facturas?: Opcion[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(
    async (anterior: EstadoGasto, datos: FormData) => {
      const resultado = await crearGasto(anterior, datos);
      if (resultado.ok) setAbierto(false);
      return resultado.ok ? ESTADO_INICIAL : resultado;
    },
    ESTADO_INICIAL,
  );

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="boton boton-principal">
        <Plus className="size-4" aria-hidden />
        Registrar gasto
      </button>
    );
  }

  return (
    <div className="tarjeta w-full">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ReceiptText className="size-4.5 text-principal" aria-hidden />
          Nuevo gasto
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
          <label htmlFor="concepto" className="etiqueta">
            Concepto
          </label>
          <input
            id="concepto"
            name="concepto"
            required
            className="campo"
            placeholder="Reparación del ascensor"
          />
        </div>

        <div>
          <label htmlFor="importe" className="etiqueta">
            Importe (€)
          </label>
          <input
            id="importe"
            name="importe"
            type="number"
            step="0.01"
            min="0"
            required
            className="campo"
            placeholder="0,00"
          />
        </div>

        <div>
          <label htmlFor="fecha" className="etiqueta">
            Fecha
          </label>
          <input
            id="fecha"
            name="fecha"
            type="date"
            required
            className="campo"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="categoriaId" className="etiqueta">
            Categoría (opcional)
          </label>
          <select id="categoriaId" name="categoriaId" className="campo" defaultValue="">
            <option value="">Sin categoría</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="proveedorId" className="etiqueta">
            Proveedor (opcional)
          </label>
          <select id="proveedorId" name="proveedorId" className="campo" defaultValue="">
            <option value="">Sin proveedor</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="facturaDocumentoId" className="etiqueta">
            Factura (opcional)
          </label>
          <select id="facturaDocumentoId" name="facturaDocumentoId" className="campo" defaultValue="">
            <option value="">Sin factura</option>
            {facturas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-suave">Sube el PDF en Documentos, carpeta Facturas.</p>
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
              <ReceiptText className="size-4" aria-hidden />
            )}
            {pendiente ? "Guardando…" : "Guardar gasto"}
          </button>
        </div>
      </form>
    </div>
  );
}
