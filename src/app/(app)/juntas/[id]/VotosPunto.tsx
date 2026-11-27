"use client";

import { useRef } from "react";
import { ThumbsUp } from "lucide-react";

export type ViviendaVotante = {
  fincaId: string;
  codigo: string;
  titulares: string;
  coeficiente: number;
  sinVoto: boolean;
  sentido: "" | "favor" | "contra" | "abstencion";
};

/**
 * Voto de cada vivienda presente en un punto. Las que tienen deudas
 * vencidas aparecen sin selector: no pueden votar (art. 15.2 LPH).
 */
export function VotosPunto({ puntoId, viviendas }: { puntoId: string; viviendas: ViviendaVotante[] }) {
  const contenedor = useRef<HTMLDivElement>(null);

  if (viviendas.length === 0) {
    return (
      <p className="text-xs text-suave">
        Anota primero la asistencia: solo votan las viviendas presentes o representadas.
      </p>
    );
  }

  const marcarTodas = () => {
    contenedor.current?.querySelectorAll<HTMLSelectElement>("select[data-voto]").forEach((select) => {
      select.value = "favor";
    });
  };

  return (
    <div ref={contenedor} className="rounded-xl border border-borde">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-3 py-2">
        <span className="text-xs font-semibold text-suave">Voto de las viviendas presentes</span>
        <button type="button" onClick={marcarTodas} className="inline-flex items-center gap-1 text-xs font-semibold text-principal">
          <ThumbsUp className="size-3.5" aria-hidden />
          Todas a favor
        </button>
      </div>
      <ul className="divide-y divide-borde">
        {viviendas.map((vivienda) => (
          <li key={vivienda.fincaId} className="flex items-center justify-between gap-3 px-3 py-1.5">
            <span className="min-w-0 text-sm">
              <span className="font-medium">{vivienda.codigo}</span>
              {vivienda.titulares && <span className="text-suave"> · {vivienda.titulares}</span>}
            </span>
            {vivienda.sinVoto ? (
              <span className="chip shrink-0 bg-peligro-claro text-peligro">Sin voto: deuda</span>
            ) : (
              <select
                data-voto
                name={`voto_${puntoId}_${vivienda.fincaId}`}
                defaultValue={vivienda.sentido}
                aria-label={`Voto de ${vivienda.codigo}`}
                className="campo w-36 shrink-0 py-1.5 text-sm"
              >
                <option value="">Sin votar</option>
                <option value="favor">A favor</option>
                <option value="contra">En contra</option>
                <option value="abstencion">Abstención</option>
              </select>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
