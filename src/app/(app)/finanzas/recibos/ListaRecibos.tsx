import Link from "next/link";
import { EtiquetaEstado } from "@/components/ui/EtiquetaEstado";
import {
  cobradoDe,
  estaVencido,
  ETIQUETA_METODO,
  etiquetaEstadoRecibo,
  finDeMes,
  nombrePeriodo,
  pendienteDe,
  type ReciboConPagos,
} from "@/lib/recibos";
import { formatoFechaCorta, formatoMoneda } from "@/lib/utilidades";
import { AccionesRecibo } from "./AccionesRecibo";

function primeraMayuscula(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Lista de recibos. Con `fincas` muestra a que vivienda pertenece cada uno
 * (vista del mes); sin ella, el periodo (ficha de una vivienda).
 */
export function ListaRecibos({
  recibos,
  fincas,
  editable,
  hoy,
  mostrarPagos = false,
}: {
  recibos: ReciboConPagos[];
  fincas?: Map<string, { codigo: string; titulares: string[] }>;
  editable: boolean;
  hoy: string;
  mostrarPagos?: boolean;
}) {
  if (recibos.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-borde bg-superficie px-4 py-6 text-center text-sm text-suave">
        No hay recibos.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
      {recibos.map((recibo) => {
        const pendiente = pendienteDe(recibo);
        const cobrado = cobradoDe(recibo);
        const vencido = estaVencido(recibo, hoy);
        const finca = fincas?.get(recibo.finca_id);
        return (
          <li key={recibo.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              {finca ? (
                <Link
                  href={`/finanzas/recibos/${recibo.finca_id}`}
                  className="font-semibold leading-snug hover:underline"
                >
                  {finca.codigo}
                  {finca.titulares.length > 0 && (
                    <span className="ml-1.5 font-normal text-suave">· {finca.titulares.join(", ")}</span>
                  )}
                </Link>
              ) : (
                <p className="font-semibold leading-snug">{primeraMayuscula(nombrePeriodo(recibo.periodo))}</p>
              )}
              <p className="text-xs text-suave">
                {recibo.concepto} · vence el {formatoFechaCorta(recibo.vence_en ?? finDeMes(recibo.periodo))}
                {vencido && <span className="font-semibold text-peligro"> · vencido</span>}
              </p>
              {recibo.notas && <p className="mt-0.5 text-xs text-suave">{recibo.notas}</p>}
              {mostrarPagos && recibo.pagos.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-suave">
                  {recibo.pagos.map((pago) => (
                    <li key={pago.id}>
                      Cobrado {formatoMoneda(pago.importe)} el {formatoFechaCorta(pago.fecha)}
                      {pago.metodo && ` · ${ETIQUETA_METODO[pago.metodo] ?? pago.metodo}`}
                      {pago.referencia && ` · ${pago.referencia}`}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="text-right">
              <p className="font-semibold tabular-nums">{formatoMoneda(recibo.importe)}</p>
              {cobrado > 0 && pendiente > 0 && (
                <p className="text-xs tabular-nums text-suave">Faltan {formatoMoneda(pendiente)}</p>
              )}
            </div>

            <EtiquetaEstado estado={etiquetaEstadoRecibo(recibo)} />

            {editable && (
              <div className="w-full sm:w-auto sm:has-[.formulario-recibo]:w-full">
                <AccionesRecibo
                  id={recibo.id}
                  pendiente={pendiente}
                  tieneCobros={recibo.pagos.length > 0}
                  estado={recibo.estado}
                  hoy={hoy}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
