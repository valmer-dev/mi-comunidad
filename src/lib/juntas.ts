/** Modos de asistencia de una vivienda a una junta. */
export type ModoAsistencia = "presencial" | "representado" | "ausente";

/**
 * Viviendas presentes o representadas y la suma de sus coeficientes. Las que
 * tienen deudas vencidas (`sinVoto`, art. 15.2 LPH) cuentan como asistentes
 * pero su coeficiente no vota: `coeficienteVoto` es lo que puede votar.
 */
export function calcularQuorum(
  viviendas: { fincaId: string; coeficiente: number; sinVoto?: boolean }[],
  modos: Record<string, ModoAsistencia | undefined>,
  coeficienteTotal: number,
) {
  let presentes = 0;
  let representadas = 0;
  let coeficiente = 0;
  let coeficienteVoto = 0;
  let sinVoto = 0;
  for (const vivienda of viviendas) {
    const modo = modos[vivienda.fincaId];
    if (modo === "presencial") presentes += 1;
    if (modo === "representado") representadas += 1;
    if (modo !== "ausente" && modo) {
      coeficiente += vivienda.coeficiente;
      if (vivienda.sinVoto) sinVoto += 1;
      else coeficienteVoto += vivienda.coeficiente;
    }
  }
  return {
    presentes,
    representadas,
    total: viviendas.length,
    coeficiente,
    porcentaje: coeficienteTotal > 0 ? (coeficiente / coeficienteTotal) * 100 : 0,
    sinVoto,
    porcentajeVoto: coeficienteTotal > 0 ? (coeficienteVoto / coeficienteTotal) * 100 : 0,
  };
}
