"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { cambiarEstadoIncidencia } from "@/app/acciones/incidencias";

export function SelectorEstado({
  id,
  estado,
}: {
  id: string;
  estado: string;
}) {
  const [pendiente, iniciar] = useTransition();

  return (
    <span className="inline-flex items-center gap-2">
      <select
        defaultValue={estado}
        disabled={pendiente}
        onChange={(evento) => {
          const nuevo = evento.target.value;
          iniciar(() => {
            void cambiarEstadoIncidencia(id, nuevo);
          });
        }}
        className="rounded-lg border border-borde bg-white px-2 py-1 text-xs font-medium"
        aria-label="Cambiar estado"
      >
        <option value="abierta">Abierta</option>
        <option value="en_curso">En curso</option>
        <option value="resuelta">Resuelta</option>
        <option value="cerrada">Cerrada</option>
      </select>
      {pendiente && <Loader2 className="size-3.5 animate-spin text-suave" aria-hidden />}
    </span>
  );
}
