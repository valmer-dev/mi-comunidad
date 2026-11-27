import { estaVencido, pendienteDe, type ReciboConPagos } from "@/lib/recibos";

/** Dias naturales para expedir el certificado desde que se pide (art. 9.1.e LPH). */
export const DIAS_CERTIFICADO = 7;

export type LineaDeuda = {
  periodo: string;
  concepto: string;
  vence_en: string | null;
  importe: number;
  pendiente: number;
  vencido: boolean;
  afecta: boolean;
};

export type DeudaCertificada = {
  detalle: LineaDeuda[];
  total: number;
  vencida: number;
  afecta: number;
};

const centimos = (n: number) => Math.round(n * 100);

/**
 * Deuda de una vivienda a fecha de hoy. La vivienda responde de lo que se debe
 * de la parte vencida de la anualidad en curso y de los tres años naturales
 * anteriores, aunque cambie de dueño (afeccion real, art. 9.1.e LPH).
 */
export function calcularDeuda(recibos: ReciboConPagos[], hoy: string): DeudaCertificada {
  const primerAnioAfecto = Number(hoy.slice(0, 4)) - 3;
  const detalle = recibos
    .map((recibo) => {
      const pendiente = pendienteDe(recibo);
      const vencido = estaVencido(recibo, hoy);
      return {
        periodo: recibo.periodo,
        concepto: recibo.concepto,
        vence_en: recibo.vence_en,
        importe: Number(recibo.importe),
        pendiente,
        vencido,
        afecta: vencido && Number(recibo.periodo.slice(0, 4)) >= primerAnioAfecto,
      };
    })
    .filter((linea) => linea.pendiente > 0)
    .sort((a, b) => a.periodo.localeCompare(b.periodo) || a.concepto.localeCompare(b.concepto));

  const suma = (lineas: LineaDeuda[]) => lineas.reduce((t, l) => t + centimos(l.pendiente), 0) / 100;
  return {
    detalle,
    total: suma(detalle),
    vencida: suma(detalle.filter((l) => l.vencido)),
    afecta: suma(detalle.filter((l) => l.afecta)),
  };
}

export function limiteCertificado(solicitadoEn: string) {
  const d = new Date(`${solicitadoEn}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + DIAS_CERTIFICADO);
  return d.toISOString().slice(0, 10);
}
