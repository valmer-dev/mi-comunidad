/**
 * Saldo en cuenta y fondo de reserva.
 *
 * saldo = saldo inicial + cuotas cobradas + otros ingresos - gastos, contando
 * desde la fecha del saldo inicial. El fondo de reserva es la parte del saldo
 * apartada para obras de conservacion (art. 9.1.f LPH).
 */

/** Porcentaje minimo del fondo de reserva sobre el presupuesto ordinario. */
export const PORCENTAJE_MINIMO_FONDO = 10;

function centimos(valor: number | string | null | undefined) {
  return Math.round(Number(valor ?? 0) * 100);
}

function sumar(filas: { importe?: number | string | null; total?: number | string | null }[]) {
  return filas.reduce((total, fila) => total + centimos(fila.importe ?? fila.total), 0);
}

export function calcularSaldo({
  saldoInicial,
  cobros,
  ingresos,
  gastos,
}: {
  saldoInicial: number | string | null | undefined;
  cobros: { total: number | string | null }[];
  ingresos: { importe: number | string | null }[];
  gastos: { total: number | string | null }[];
}) {
  const entradas = sumar(cobros) + sumar(ingresos);
  const salidas = sumar(gastos);
  return {
    saldo: (centimos(saldoInicial) + entradas - salidas) / 100,
    entradas: entradas / 100,
    salidas: salidas / 100,
  };
}

export function saldoFondo(movimientos: { tipo: string; importe: number | string }[]) {
  return (
    movimientos.reduce(
      (total, movimiento) =>
        total + (movimiento.tipo === "dotacion" ? 1 : -1) * centimos(movimiento.importe),
      0,
    ) / 100
  );
}

/**
 * Minimo legal del fondo: el 10 % del ultimo presupuesto ordinario. Mientras
 * no haya presupuestos en la app se estima con la cuota mensual por 12.
 */
export function minimoFondo(presupuestoOrdinarioAnual: number) {
  return Math.round(presupuestoOrdinarioAnual * PORCENTAJE_MINIMO_FONDO) / 100;
}
