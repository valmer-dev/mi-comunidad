"use client";

import { useActionState, useState } from "react";
import { Ban, Check, Loader2, Undo2, X } from "lucide-react";
import {
  anularRecibo,
  devolverRecibo,
  registrarCobro,
  type EstadoRecibos,
} from "@/app/acciones/recibos";
import { METODOS_PAGO } from "@/lib/recibos";

const ESTADO_INICIAL: EstadoRecibos = {};

type Modo = "nada" | "cobrar" | "devolver";

/**
 * Botones de un recibo para quien lleva las finanzas: cobrar (total o
 * parcial), marcar la devolucion del banco y anular.
 */
export function AccionesRecibo({
  id,
  pendiente,
  tieneCobros,
  estado,
  hoy,
}: {
  id: string;
  pendiente: number;
  tieneCobros: boolean;
  estado: string;
  hoy: string;
}) {
  const [modo, setModo] = useState<Modo>("nada");

  const [estadoCobro, accionCobro, cobrando] = useActionState(
    async (anterior: EstadoRecibos, datos: FormData) => {
      const resultado = await registrarCobro(anterior, datos);
      if (resultado.ok) setModo("nada");
      return resultado.ok ? ESTADO_INICIAL : resultado;
    },
    ESTADO_INICIAL,
  );
  const [estadoDevolucion, accionDevolucion, devolviendo] = useActionState(
    async (anterior: EstadoRecibos, datos: FormData) => {
      const resultado = await devolverRecibo(anterior, datos);
      if (resultado.ok) setModo("nada");
      return resultado.ok ? ESTADO_INICIAL : resultado;
    },
    ESTADO_INICIAL,
  );
  const [estadoAnular, accionAnular, anulando] = useActionState(anularRecibo, ESTADO_INICIAL);

  if (estado === "anulado") return null;

  if (modo === "cobrar") {
    return (
      <form action={accionCobro} className="formulario-recibo grid w-full gap-2 rounded-xl bg-hundido p-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={id} />
        <div>
          <label htmlFor={`importe_${id}`} className="etiqueta">
            Importe (€)
          </label>
          <input
            id={`importe_${id}`}
            name="importe"
            inputMode="decimal"
            required
            defaultValue={pendiente.toFixed(2).replace(".", ",")}
            className="campo"
          />
        </div>
        <div>
          <label htmlFor={`fecha_${id}`} className="etiqueta">
            Fecha
          </label>
          <input
            id={`fecha_${id}`}
            name="fecha"
            type="date"
            required
            defaultValue={hoy}
            max={hoy}
            className="campo"
          />
        </div>
        <div>
          <label htmlFor={`metodo_${id}`} className="etiqueta">
            Forma de pago
          </label>
          <select id={`metodo_${id}`} name="metodo" defaultValue="transferencia" className="campo">
            {METODOS_PAGO.map((metodo) => (
              <option key={metodo.valor} value={metodo.valor}>
                {metodo.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`referencia_${id}`} className="etiqueta">
            Referencia (opcional)
          </label>
          <input id={`referencia_${id}`} name="referencia" className="campo" placeholder="Nº de operación" />
        </div>
        {estadoCobro.error && <p className="aviso aviso-error sm:col-span-2">{estadoCobro.error}</p>}
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" disabled={cobrando} className="boton boton-principal flex-1">
            {cobrando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            Guardar cobro
          </button>
          <button type="button" onClick={() => setModo("nada")} className="boton boton-borde">
            <X className="size-4" aria-hidden />
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  if (modo === "devolver") {
    return (
      <form action={accionDevolucion} className="formulario-recibo grid w-full gap-2 rounded-xl bg-hundido p-3">
        <input type="hidden" name="id" value={id} />
        <p className="text-sm">
          Se borran los cobros de este recibo y queda como <strong>devuelto</strong>, pendiente de
          pago.
        </p>
        <div>
          <label htmlFor={`nota_${id}`} className="etiqueta">
            Motivo (opcional)
          </label>
          <input id={`nota_${id}`} name="nota" className="campo" placeholder="Cuenta sin saldo" />
        </div>
        {estadoDevolucion.error && <p className="aviso aviso-error">{estadoDevolucion.error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={devolviendo} className="boton boton-peligro flex-1">
            {devolviendo ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Undo2 className="size-4" aria-hidden />}
            Marcar devuelto
          </button>
          <button type="button" onClick={() => setModo("nada")} className="boton boton-borde">
            <X className="size-4" aria-hidden />
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pendiente > 0 && (
        <button type="button" onClick={() => setModo("cobrar")} className="boton boton-principal px-3 py-1.5 text-xs">
          <Check className="size-3.5" aria-hidden />
          Cobrar
        </button>
      )}
      {tieneCobros && (
        <button type="button" onClick={() => setModo("devolver")} className="boton boton-borde px-3 py-1.5 text-xs">
          <Undo2 className="size-3.5" aria-hidden />
          Devolución
        </button>
      )}
      {!tieneCobros && (
        <form
          action={accionAnular}
          onSubmit={(evento) => {
            if (!window.confirm("¿Anular este recibo? Dejará de contar como deuda.")) {
              evento.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={anulando} className="boton boton-borde px-3 py-1.5 text-xs">
            {anulando ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Ban className="size-3.5" aria-hidden />}
            Anular
          </button>
        </form>
      )}
      {estadoAnular.error && <p className="w-full text-xs text-peligro">{estadoAnular.error}</p>}
    </div>
  );
}
