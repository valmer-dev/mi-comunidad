"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { guardarAsistencia } from "@/app/acciones/juntas";
import { calcularQuorum, type ModoAsistencia } from "@/lib/juntas";
import { FormularioJunta } from "./FormularioJunta";

export type ViviendaAsistencia = {
  fincaId: string;
  codigo: string;
  titulares: string;
  coeficiente: number;
  modo: ModoAsistencia;
  representante: string;
  /** Tiene deudas vencidas el dia de la junta: asiste pero no vota. */
  sinVoto?: boolean;
};

/** Pasar lista: una fila por vivienda con su modo de asistencia y el quórum en vivo. */
export function ListaAsistencia({
  juntaId,
  viviendas,
  coeficienteTotal,
}: {
  juntaId: string;
  viviendas: ViviendaAsistencia[];
  coeficienteTotal: number;
}) {
  const [modos, setModos] = useState<Record<string, ViviendaAsistencia["modo"]>>(() =>
    Object.fromEntries(viviendas.map((v) => [v.fincaId, v.modo])),
  );

  const quorum = useMemo(() => calcularQuorum(viviendas, modos, coeficienteTotal), [
    viviendas,
    modos,
    coeficienteTotal,
  ]);

  return (
    <FormularioJunta
      accion={guardarAsistencia}
      juntaId={juntaId}
      boton={
        <>
          <Save className="size-4" aria-hidden />
          Guardar asistencia
        </>
      }
    >
      <ResumenQuorum {...quorum} />
      <ul className="mt-3 divide-y divide-borde">
        {viviendas.map((vivienda) => {
          const modo = modos[vivienda.fincaId];
          return (
            <li key={vivienda.fincaId} className="grid gap-2 py-2.5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="font-medium">
                  {vivienda.codigo}
                  <span className="ml-2 text-xs font-normal text-suave">
                    {vivienda.coeficiente.toLocaleString("es-ES")} %
                  </span>
                </p>
                <p className="truncate text-sm text-suave">{vivienda.titulares || "Sin titular"}</p>
                {vivienda.sinVoto && (
                  <span className="chip mt-1 bg-peligro-claro text-peligro">Sin voto: deuda vencida</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  name={`modo_${vivienda.fincaId}`}
                  aria-label={`Asistencia de ${vivienda.codigo}`}
                  className="campo w-auto"
                  value={modo}
                  onChange={(evento) =>
                    setModos((anterior) => ({
                      ...anterior,
                      [vivienda.fincaId]: evento.target.value as ViviendaAsistencia["modo"],
                    }))
                  }
                >
                  <option value="ausente">Ausente</option>
                  <option value="presencial">Presente</option>
                  <option value="representado">Representada</option>
                </select>
                {modo === "representado" && (
                  <input
                    name={`representante_${vivienda.fincaId}`}
                    defaultValue={vivienda.representante}
                    aria-label={`Representante de ${vivienda.codigo}`}
                    placeholder="Nombre del representante"
                    className="campo w-auto min-w-0 flex-1 sm:w-56"
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </FormularioJunta>
  );
}

/** Viviendas presentes o representadas y la suma de sus coeficientes. */
export function ResumenQuorum({
  presentes,
  representadas,
  total,
  porcentaje,
  sinVoto,
  porcentajeVoto,
}: ReturnType<typeof calcularQuorum>) {
  const asistentes = presentes + representadas;
  const mayoria = total > 0 && asistentes * 2 > total && porcentaje > 50;
  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl bg-hundido p-3 text-sm sm:grid-cols-3">
      <div>
        <p className="text-suave">Viviendas</p>
        <p className="text-lg font-semibold">
          {asistentes} <span className="text-sm font-normal text-suave">de {total}</span>
        </p>
        <p className="text-xs text-suave">
          {presentes} presentes · {representadas} representadas
        </p>
      </div>
      <div>
        <p className="text-suave">Coeficiente</p>
        <p className="text-lg font-semibold">
          {porcentaje.toLocaleString("es-ES", { maximumFractionDigits: 2 })} %
        </p>
        {sinVoto > 0 && (
          <p className="text-xs text-peligro">
            Votan {porcentajeVoto.toLocaleString("es-ES", { maximumFractionDigits: 2 })} %:{" "}
            {sinVoto} sin voto por deudas
          </p>
        )}
      </div>
      <div className="col-span-2 sm:col-span-1">
        <p className="text-suave">Primera convocatoria</p>
        <p className={mayoria ? "font-semibold text-exito" : "font-semibold text-atencion"}>
          {mayoria ? "Hay quórum" : "Sin quórum"}
        </p>
        <p className="text-xs text-suave">Mayoría de viviendas y de coeficientes</p>
      </div>
    </div>
  );
}
