/** Modos de asistencia de una vivienda a una junta. */
export type ModoAsistencia = "presencial" | "representado" | "ausente";

/** Viviendas presentes o representadas y la suma de sus coeficientes. */
export function calcularQuorum(
  viviendas: { fincaId: string; coeficiente: number }[],
  modos: Record<string, ModoAsistencia | undefined>,
  coeficienteTotal: number,
) {
  let presentes = 0;
  let representadas = 0;
  let coeficiente = 0;
  for (const vivienda of viviendas) {
    const modo = modos[vivienda.fincaId];
    if (modo === "presencial") presentes += 1;
    if (modo === "representado") representadas += 1;
    if (modo !== "ausente" && modo) coeficiente += vivienda.coeficiente;
  }
  return {
    presentes,
    representadas,
    total: viviendas.length,
    coeficiente,
    porcentaje: coeficienteTotal > 0 ? (coeficiente / coeficienteTotal) * 100 : 0,
  };
}

