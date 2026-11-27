"use client";

import { useActionState, useState } from "react";
import { ClipboardList, Loader2, Save } from "lucide-react";
import { guardarGestionIncidencia, type EstadoIncidencia } from "@/app/acciones/incidencias";
import { ESTADOS_SEGURO, RESPONSABLES } from "@/lib/incidencias";

const ESTADO_INICIAL: EstadoIncidencia = {};

type Opcion = { id: string; nombre: string };

export type DatosGestion = {
  id: string;
  proveedor_id: string | null;
  coste: number | null;
  responsable: string;
  finca_id: string | null;
  gasto_id: string | null;
  seguro_parte: string | null;
  seguro_comunicado_en: string | null;
  seguro_estado: string | null;
  seguro_indemnizacion: number | null;
};

const aTexto = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

/** Formulario de la junta: quien lo arregla, cuanto cuesta, quien paga y el parte al seguro. */
export function GestionIncidencia({
  incidencia,
  proveedores,
  fincas,
  editaFinanzas,
  seguro,
}: {
  incidencia: DatosGestion;
  proveedores: Opcion[];
  fincas: Opcion[];
  editaFinanzas: boolean;
  /** Aseguradora de la comunidad, si esta en Servicios. */
  seguro: { nombre: string; telefono: string | null } | null;
}) {
  const [estado, accion, pendiente] = useActionState(guardarGestionIncidencia, ESTADO_INICIAL);
  const [responsable, setResponsable] = useState(incidencia.responsable);
  const p = incidencia.id;

  return (
    <details className="mt-3 rounded-xl border border-borde">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium">
        <ClipboardList className="size-4 text-principal" aria-hidden />
        Gestión: proveedor, coste y seguro
      </summary>
      <form action={accion} className="grid gap-3 border-t border-borde p-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={incidencia.id} />

        <div>
          <label htmlFor={`proveedor-${p}`} className="etiqueta">
            Quién lo arregla
          </label>
          <select id={`proveedor-${p}`} name="proveedorId" defaultValue={incidencia.proveedor_id ?? ""} className="campo">
            <option value="">Sin asignar</option>
            {proveedores.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`coste-${p}`} className="etiqueta">
            Coste (€)
          </label>
          <input
            id={`coste-${p}`}
            name="coste"
            inputMode="decimal"
            defaultValue={aTexto(incidencia.coste)}
            className="campo"
            placeholder="0,00"
          />
        </div>

        <div>
          <label htmlFor={`responsable-${p}`} className="etiqueta">
            Quién paga
          </label>
          <select
            id={`responsable-${p}`}
            name="responsable"
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
            className="campo"
          >
            {Object.entries(RESPONSABLES).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`finca-${p}`} className="etiqueta">
            Vivienda afectada{responsable === "privativo" ? "" : " (opcional)"}
          </label>
          <select
            id={`finca-${p}`}
            name="fincaId"
            defaultValue={incidencia.finca_id ?? ""}
            required={responsable === "privativo"}
            className="campo"
          >
            <option value="">Ninguna en concreto</option>
            {fincas.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
        </div>

        {responsable === "privativo" && (
          <p className="text-xs text-suave sm:col-span-2">
            Lo que está dentro de la vivienda y solo le sirve a ella lo paga su propietario. Si el daño
            viene de un elemento común (bajante, fachada, cubierta), lo paga la comunidad.
          </p>
        )}

        {editaFinanzas && responsable === "comunidad" && !incidencia.gasto_id && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="apuntarGasto" className="size-4" />
            Apuntar el coste en los gastos de la comunidad
          </label>
        )}
        {incidencia.gasto_id && (
          <p className="text-xs text-suave sm:col-span-2">El coste ya está apuntado en los gastos.</p>
        )}

        <fieldset className="grid gap-3 rounded-xl border border-borde p-3 sm:col-span-2 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">Parte al seguro</legend>
          {seguro && (
            <p className="text-xs text-suave sm:col-span-2">
              Seguro de la comunidad: {seguro.nombre}
              {seguro.telefono && (
                <>
                  {" · "}
                  <a href={`tel:${seguro.telefono.replace(/[^\d+]/g, "")}`} className="text-principal hover:underline">
                    {seguro.telefono}
                  </a>
                </>
              )}
            </p>
          )}
          <div>
            <label htmlFor={`parte-${p}`} className="etiqueta">
              Número de parte o siniestro
            </label>
            <input id={`parte-${p}`} name="seguroParte" defaultValue={incidencia.seguro_parte ?? ""} className="campo" />
          </div>
          <div>
            <label htmlFor={`comunicado-${p}`} className="etiqueta">
              Comunicado el
            </label>
            <input
              id={`comunicado-${p}`}
              name="seguroComunicadoEn"
              type="date"
              defaultValue={incidencia.seguro_comunicado_en ?? ""}
              className="campo"
            />
          </div>
          <div>
            <label htmlFor={`estado-seguro-${p}`} className="etiqueta">
              Estado
            </label>
            <select id={`estado-seguro-${p}`} name="seguroEstado" defaultValue={incidencia.seguro_estado ?? ""} className="campo">
              <option value="">Sin parte</option>
              {Object.entries(ESTADOS_SEGURO).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`indemnizacion-${p}`} className="etiqueta">
              Indemnización (€)
            </label>
            <input
              id={`indemnizacion-${p}`}
              name="seguroIndemnizacion"
              inputMode="decimal"
              defaultValue={aTexto(incidencia.seguro_indemnizacion)}
              className="campo"
            />
          </div>
        </fieldset>

        {estado.error && <p className="aviso aviso-error sm:col-span-2">{estado.error}</p>}
        {estado.ok && estado.mensaje && <p className="aviso aviso-exito sm:col-span-2">{estado.mensaje}</p>}

        <div className="sm:col-span-2">
          <button type="submit" disabled={pendiente} className="boton boton-principal">
            {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
            {pendiente ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </details>
  );
}
