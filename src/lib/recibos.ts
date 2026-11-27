/**
 * Recibos de cuota por vivienda y su estado de cuentas.
 *
 * El estado del recibo lo calcula la base de datos a partir de sus pagos
 * (pendiente, pagado), salvo devuelto y anulado, que se marcan a mano. Aqui
 * solo se resume para mostrarlo.
 */

export type EstadoRecibo = "pendiente" | "pagado" | "devuelto" | "aplazado" | "anulado";

export type ReciboConPagos = {
  id: string;
  finca_id: string;
  periodo: string;
  concepto: string;
  importe: number;
  estado: EstadoRecibo;
  vence_en: string | null;
  pagado_en: string | null;
  notas: string | null;
  pagos: { id: string; importe: number; fecha: string; metodo: string | null; referencia: string | null }[];
};

export const METODOS_PAGO = [
  { valor: "transferencia", etiqueta: "Transferencia" },
  { valor: "domiciliacion", etiqueta: "Domiciliación" },
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "bizum", etiqueta: "Bizum" },
  { valor: "otro", etiqueta: "Otro" },
] as const;

export const ETIQUETA_METODO: Record<string, string> = Object.fromEntries(
  METODOS_PAGO.map((metodo) => [metodo.valor, metodo.etiqueta]),
);

/** Trabaja en centimos para que las sumas no arrastren decimales. */
function centimos(valor: number | string | null | undefined) {
  return Math.round(Number(valor ?? 0) * 100);
}

export function cobradoDe(recibo: Pick<ReciboConPagos, "pagos">) {
  return recibo.pagos.reduce((total, pago) => total + centimos(pago.importe), 0) / 100;
}

/** Lo que falta por cobrar de un recibo. Los anulados no deben nada. */
export function pendienteDe(recibo: Pick<ReciboConPagos, "importe" | "estado" | "pagos">) {
  if (recibo.estado === "anulado") return 0;
  return Math.max(centimos(recibo.importe) - centimos(cobradoDe(recibo)), 0) / 100;
}

/** Hoy en formato AAAA-MM-DD, en hora de Madrid. */
export function hoyISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

/** Un recibo esta vencido si debe algo y su fecha de vencimiento ya paso. */
export function estaVencido(
  recibo: Pick<ReciboConPagos, "importe" | "estado" | "pagos" | "vence_en" | "periodo">,
  hoy = hoyISO(),
) {
  if (pendienteDe(recibo) <= 0) return false;
  const vence = recibo.vence_en ?? finDeMes(recibo.periodo);
  return vence < hoy;
}

/** Ultimo dia del mes de un periodo AAAA-MM-01. */
export function finDeMes(periodo: string) {
  const [anio, mes] = periodo.slice(0, 7).split("-").map(Number);
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${periodo.slice(0, 7)}-${String(ultimo).padStart(2, "0")}`;
}

export type ResumenCuenta = {
  emitido: number;
  cobrado: number;
  pendiente: number;
  vencido: number;
  recibosPendientes: number;
  deudaDesde: string | null;
};

/** Totales de un conjunto de recibos (una vivienda o toda la comunidad). */
export function resumirRecibos(recibos: ReciboConPagos[], hoy = hoyISO()): ResumenCuenta {
  let emitido = 0;
  let cobrado = 0;
  let pendiente = 0;
  let vencido = 0;
  let recibosPendientes = 0;
  let deudaDesde: string | null = null;

  for (const recibo of recibos) {
    if (recibo.estado === "anulado") continue;
    const debe = centimos(pendienteDe(recibo));
    emitido += centimos(recibo.importe);
    cobrado += centimos(cobradoDe(recibo));
    pendiente += debe;
    if (debe > 0) {
      recibosPendientes += 1;
      if (estaVencido(recibo, hoy)) {
        vencido += debe;
        if (!deudaDesde || recibo.periodo < deudaDesde) deudaDesde = recibo.periodo;
      }
    }
  }

  return {
    emitido: emitido / 100,
    cobrado: cobrado / 100,
    pendiente: pendiente / 100,
    vencido: vencido / 100,
    recibosPendientes,
    deudaDesde,
  };
}

/** "2026-11" a partir de cualquier fecha AAAA-MM-DD. */
export function mesDe(fecha: string) {
  return fecha.slice(0, 7);
}

/** Nombre del periodo: "noviembre de 2026". */
export function nombrePeriodo(periodo: string) {
  const [anio, mes] = periodo.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, 1)).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Etiqueta visible del estado, distinguiendo el pago parcial. */
export function etiquetaEstadoRecibo(recibo: Pick<ReciboConPagos, "importe" | "estado" | "pagos">) {
  if (recibo.estado === "pendiente" && cobradoDe(recibo) > 0) return "parcial";
  return recibo.estado;
}
