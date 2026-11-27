/**
 * Presupuesto anual: la cuota mensual que sale de el es lo que falta por
 * cubrir con cuotas (gastos previstos menos otros ingresos previstos) entre
 * doce meses.
 */
export function cuotaMensualDe(presupuesto: {
  total_gastos: number | string;
  total_ingresos: number | string;
}) {
  const centimos =
    Math.round(Number(presupuesto.total_gastos) * 100) -
    Math.round(Number(presupuesto.total_ingresos) * 100);
  return Math.max(Math.round(centimos / 12), 0) / 100;
}

/** Parte de un importe que corresponde a una finca segun su coeficiente. */
export function parteDe(importe: number, coeficiente: number, coeficienteTotal = 100) {
  if (coeficienteTotal <= 0) return 0;
  return Math.round(importe * 100 * (coeficiente / coeficienteTotal)) / 100;
}

export const ETIQUETA_ESTADO_PRESUPUESTO: Record<string, string> = {
  borrador: "Borrador",
  aprobado: "Aprobado",
  cerrado: "Cerrado",
};
