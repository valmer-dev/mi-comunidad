"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle, Briefcase, FileText, Loader2, Mail, Pencil, Phone, Save, X } from "lucide-react";
import {
  actualizarServicio,
  eliminarServicio,
  type EstadoServicio,
} from "@/app/acciones/servicios";
import type { EstadoVencimiento } from "@/lib/proveedores";
import { BotonEliminar } from "@/components/ui/BotonEliminar";
import { CamposServicio, type DocumentoContrato, type Servicio } from "./CamposServicio";

export type { Servicio };

export type GastoServicio = { id: string; concepto: string; fecha: string; total: number };

export type FichaJunta = {
  contrato: EstadoVencimiento;
  seguro: EstadoVencimiento;
  enlaceContrato: string | null;
  gastadoAnio: number;
  gastadoTotal: number;
  ultimosGastos: GastoServicio[];
};

const ESTADO_INICIAL: EstadoServicio = {};

const FECHA = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fecha = (iso: string) => FECHA.format(new Date(`${iso}T00:00:00Z`));
const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

function enlaceTelefono(telefono: string) {
  return `tel:${telefono.replace(/[^\d+]/g, "")}`;
}

function Vencimiento({ etiqueta, estado }: { etiqueta: string; estado: EstadoVencimiento }) {
  if (estado.tipo === "sin_fecha") return null;
  if (estado.tipo === "vencido") {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-peligro">
        <AlertTriangle className="size-3.5" aria-hidden />
        {etiqueta} vencido el {fecha(estado.fin)}
      </p>
    );
  }
  if (estado.tipo === "proximo") {
    return (
      <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-atencion">
        <AlertTriangle className="size-3.5" aria-hidden />
        {etiqueta} vence el {fecha(estado.fin)} ({estado.dias === 0 ? "hoy" : `en ${estado.dias} días`})
        {estado.limitePreaviso && <span className="font-normal">· avisar antes del {fecha(estado.limitePreaviso)}</span>}
      </p>
    );
  }
  return (
    <p className="text-sm text-suave">
      {etiqueta} hasta el {fecha(estado.fin)}
    </p>
  );
}

function FormularioEditar({
  servicio,
  documentos,
  alCerrar,
}: {
  servicio: Servicio;
  documentos: DocumentoContrato[];
  alCerrar: () => void;
}) {
  const [estado, accion, pendiente] = useActionState(actualizarServicio, ESTADO_INICIAL);

  useEffect(() => {
    if (estado.ok) alCerrar();
  }, [estado, alCerrar]);

  return (
    <form action={accion}>
      <input type="hidden" name="id" value={servicio.id} />
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Pencil className="size-4.5 text-principal" aria-hidden />
          Editar servicio
        </h2>
        <button
          type="button"
          onClick={alCerrar}
          className="grid size-11 place-items-center rounded-full text-suave hover:bg-hundido hover:text-tinta"
          aria-label="Cerrar"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <CamposServicio servicio={servicio} documentos={documentos} />

        {estado.error && <p className="aviso aviso-error sm:col-span-2">{estado.error}</p>}

        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" disabled={pendiente} className="boton boton-principal">
            {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
            {pendiente ? "Guardando…" : "Guardar cambios"}
          </button>
          <button type="button" onClick={alCerrar} className="boton boton-borde">
            <X className="size-4" aria-hidden />
            Cancelar
          </button>
        </div>
      </div>
    </form>
  );
}

export function ServicioItem({
  servicio,
  puedeGestionar,
  documentos,
  ficha,
}: {
  servicio: Servicio;
  puedeGestionar: boolean;
  documentos: DocumentoContrato[];
  /** Datos del contrato y del gasto; solo para la junta. */
  ficha: FichaJunta | null;
}) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <li className="tarjeta" id={`servicio-${servicio.id}`}>
        <FormularioEditar servicio={servicio} documentos={documentos} alCerrar={() => setEditando(false)} />
      </li>
    );
  }

  return (
    <li className="tarjeta" id={`servicio-${servicio.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-principal/10 text-principal">
            <Briefcase className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold leading-snug">
              {servicio.categoria || "Servicio sin especificar"}
            </h2>
            <p className="mt-0.5 text-sm font-medium text-tinta/90">
              {servicio.nombre}
              {servicio.cif && ficha && <span className="font-normal text-suave"> · CIF {servicio.cif}</span>}
            </p>
            {servicio.persona_contacto && <p className="text-sm text-suave">Contacto: {servicio.persona_contacto}</p>}
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {servicio.telefono ? (
                <a
                  href={enlaceTelefono(servicio.telefono)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-principal hover:underline"
                >
                  <Phone className="size-3.5" aria-hidden />
                  {servicio.telefono}
                </a>
              ) : (
                <p className="text-sm text-suave">Sin teléfono de contacto</p>
              )}
              {servicio.correo && (
                <a
                  href={`mailto:${servicio.correo}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-principal hover:underline"
                >
                  <Mail className="size-3.5" aria-hidden />
                  {servicio.correo}
                </a>
              )}
            </div>
          </div>
        </div>

        {puedeGestionar && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="boton boton-borde px-3 py-1.5 text-xs"
            >
              <Pencil className="size-3.5" aria-hidden />
              Editar
            </button>
            <BotonEliminar
              accion={eliminarServicio}
              id={servicio.id}
              etiqueta="Eliminar"
              titulo="Eliminar servicio"
              mensaje={`¿Eliminar el servicio «${servicio.categoria ?? servicio.nombre}» de ${servicio.nombre}? Sus gastos se conservan, sin proveedor.`}
            />
          </div>
        )}
      </div>

      {ficha && (
        <div className="mt-3 space-y-1 border-t border-borde pt-3">
          <Vencimiento etiqueta="Contrato" estado={ficha.contrato} />
          {ficha.contrato.tipo !== "sin_fecha" && (
            <p className="text-xs text-suave">
              {servicio.contrato_inicio && `Desde el ${fecha(servicio.contrato_inicio)}. `}
              {servicio.renovacion_automatica ? "Se renueva solo" : "No se renueva solo"}
              {servicio.preaviso_dias ? `, con ${servicio.preaviso_dias} días de preaviso` : ""}.
            </p>
          )}
          {servicio.importe_anual != null && (
            <p className="text-sm">Importe del contrato: {euros(Number(servicio.importe_anual))} al año</p>
          )}
          <Vencimiento etiqueta="Seguro" estado={ficha.seguro} />
          {ficha.enlaceContrato && (
            <a
              href={ficha.enlaceContrato}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-principal hover:underline"
            >
              <FileText className="size-3.5" aria-hidden />
              Ver el contrato (PDF)
            </a>
          )}
          {servicio.notas && <p className="whitespace-pre-line text-sm text-suave">{servicio.notas}</p>}

          {ficha.gastadoTotal > 0 ? (
            <details className="pt-1 text-sm">
              <summary className="cursor-pointer">
                Gastado este año: <span className="font-medium tabular-nums">{euros(ficha.gastadoAnio)}</span>
                {" · "}en total: <span className="tabular-nums">{euros(ficha.gastadoTotal)}</span>
              </summary>
              <ul className="mt-2 divide-y divide-borde rounded-xl border border-borde">
                {ficha.ultimosGastos.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                    <span className="min-w-0 truncate">
                      {g.concepto} <span className="text-suave">· {fecha(g.fecha)}</span>
                    </span>
                    <span className="tabular-nums">{euros(g.total)}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="pt-1 text-xs text-suave">Todavía no hay gastos de este proveedor.</p>
          )}
        </div>
      )}
    </li>
  );
}
