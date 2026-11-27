"use client";

import { useActionState, useState } from "react";
import { Briefcase, Loader2, Plus, X } from "lucide-react";
import { crearServicio, type EstadoServicio } from "@/app/acciones/servicios";
import { CamposServicio, type DocumentoContrato } from "./CamposServicio";

const ESTADO_INICIAL: EstadoServicio = {};

export function NuevoServicio({ documentos }: { documentos: DocumentoContrato[] }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(
    async (anterior: EstadoServicio, datos: FormData) => {
      const resultado = await crearServicio(anterior, datos);
      if (resultado.ok) setAbierto(false);
      return resultado.ok ? ESTADO_INICIAL : resultado;
    },
    ESTADO_INICIAL,
  );

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
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Briefcase className="size-4.5 text-principal" aria-hidden />
            Nuevo servicio
          </h2>
          <p className="mt-0.5 text-sm text-suave">
            Los vecinos ven el servicio, la empresa y el teléfono; los datos del contrato se muestran a la junta.
          </p>
        </div>
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
        <CamposServicio documentos={documentos} />

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
              <Briefcase className="size-4" aria-hidden />
            )}
            {pendiente ? "Guardando…" : "Guardar servicio"}
          </button>
        </div>
      </form>
    </div>
  );
}
