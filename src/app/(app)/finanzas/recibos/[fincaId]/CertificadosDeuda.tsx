"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FileCheck2, Loader2, Plus, X } from "lucide-react";
import {
  eliminarSolicitudCertificado,
  emitirCertificado,
  solicitarCertificado,
  type EstadoCertificado,
} from "@/app/acciones/certificados";
import { BotonEliminar } from "@/components/ui/BotonEliminar";

const ESTADO_INICIAL: EstadoCertificado = {};

export type FilaCertificado = {
  id: string;
  numero: number | null;
  solicitante: string;
  solicitado_en: string;
  emitido_en: string | null;
  deuda_total: number | null;
  limite: string;
};

const FECHA = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fecha = (iso: string) => FECHA.format(new Date(`${iso}T00:00:00Z`));
const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

function BotonEmitir({ id }: { id: string }) {
  const [estado, accion, pendiente] = useActionState(emitirCertificado, ESTADO_INICIAL);
  return (
    <form action={accion}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pendiente} className="boton boton-principal px-3 py-1.5 text-xs">
        {pendiente ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <FileCheck2 className="size-3.5" aria-hidden />}
        Emitir ahora
      </button>
      {estado.error && <p className="mt-1 text-xs text-peligro">{estado.error}</p>}
    </form>
  );
}

export function CertificadosDeuda({
  fincaId,
  titulares,
  certificados,
  editor,
  hoy,
}: {
  fincaId: string;
  titulares: string;
  certificados: FilaCertificado[];
  editor: boolean;
  hoy: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(solicitarCertificado, ESTADO_INICIAL);

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="sobretitulo">Certificados de deuda ({certificados.length})</h2>
        {editor && !abierto && (
          <button type="button" onClick={() => setAbierto(true)} className="boton boton-borde px-3 py-1.5 text-xs">
            <Plus className="size-3.5" aria-hidden />
            Nuevo certificado
          </button>
        )}
      </div>

      {editor && abierto && (
        <div className="tarjeta mb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Certificado de deuda</h3>
              <p className="mt-0.5 text-sm text-suave">
                Para vender la vivienda hace falta acreditar que está al corriente o lo que debe. La
                comunidad tiene 7 días naturales desde que se pide para expedirlo (art. 9.1.e LPH).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="grid size-11 shrink-0 place-items-center rounded-full text-suave hover:bg-hundido hover:text-tinta"
              aria-label="Cerrar"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <form action={accion} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="fincaId" value={fincaId} />
            <div className="sm:col-span-2">
              <label htmlFor="solicitante" className="etiqueta">
                Quién lo pide
              </label>
              <input id="solicitante" name="solicitante" required defaultValue={titulares} className="campo" />
            </div>
            <div>
              <label htmlFor="motivo" className="etiqueta">
                Para qué
              </label>
              <select id="motivo" name="motivo" defaultValue="compraventa" className="campo">
                <option value="compraventa">Venta de la vivienda</option>
                <option value="otro">Otro motivo</option>
              </select>
            </div>
            <div>
              <label htmlFor="solicitadoEn" className="etiqueta">
                Lo pidió el
              </label>
              <input id="solicitadoEn" name="solicitadoEn" type="date" required max={hoy} defaultValue={hoy} className="campo" />
            </div>
            {estado.error && <p className="aviso aviso-error sm:col-span-2">{estado.error}</p>}
            {estado.ok && estado.mensaje && <p className="aviso aviso-exito sm:col-span-2">{estado.mensaje}</p>}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" name="emitir" value="si" disabled={pendiente} className="boton boton-principal">
                {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileCheck2 className="size-4" aria-hidden />}
                Emitir con la deuda de hoy
              </button>
              <button type="submit" name="emitir" value="no" disabled={pendiente} className="boton boton-borde">
                Solo anotar la solicitud
              </button>
            </div>
          </form>
        </div>
      )}

      {certificados.length > 0 ? (
        <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
          {certificados.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                {c.emitido_en ? (
                  <Link href={`/finanzas/recibos/${fincaId}/certificado/${c.id}`} className="font-medium hover:underline">
                    Nº {c.numero}/{c.emitido_en.slice(0, 4)} · {fecha(c.emitido_en)}
                  </Link>
                ) : (
                  <p className="font-medium">
                    Pedido el {fecha(c.solicitado_en)}
                    <span className={c.limite < hoy ? " text-peligro" : " text-atencion"}>
                      {" "}· emitir antes del {fecha(c.limite)}
                    </span>
                  </p>
                )}
                <p className="text-xs text-suave">Lo pide {c.solicitante}</p>
              </div>
              {c.emitido_en ? (
                <span className="tabular-nums">{c.deuda_total ? euros(c.deuda_total) : "Al corriente"}</span>
              ) : (
                editor && (
                  <div className="flex items-center gap-2">
                    <BotonEmitir id={c.id} />
                    <BotonEliminar
                      accion={eliminarSolicitudCertificado}
                      id={c.id}
                      etiqueta="Borrar"
                      titulo="Borrar solicitud"
                      mensaje="¿Borrar esta solicitud de certificado?"
                    />
                  </div>
                )
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-suave">No se ha pedido ningún certificado de esta vivienda.</p>
      )}
    </section>
  );
}
