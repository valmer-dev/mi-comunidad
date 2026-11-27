/**
 * Calculo del resultado de una votacion segun la Ley de Propiedad Horizontal.
 *
 * - simple (art. 17.7, segunda convocatoria): mas de la mitad de los
 *   asistentes con voto, que a su vez representen mas de la mitad de las
 *   cuotas de los asistentes.
 * - doble, mayoria absoluta (art. 17.4 y 17.7, primera convocatoria): mas de la
 *   mitad del total de propietarios y de cuotas.
 * - tres_quintos (art. 17.3): tres quintas partes del total de propietarios
 *   que representen tres quintas partes de las cuotas.
 * - unanimidad (art. 17.6): todos los propietarios y todas las cuotas.
 *
 * Los propietarios con deudas vencidas no votan (art. 15.2) y no cuentan para
 * la mayoria. En las mayorias calculadas sobre el total, los ausentes que no
 * se oponen en 30 dias naturales desde que se les notifica el acta cuentan a
 * favor (art. 17.8). Cada vivienda cuenta como un propietario.
 */

export type Mayoria = "simple" | "doble" | "tres_quintos" | "unanimidad";
export type Sentido = "favor" | "contra" | "abstencion";

export const MAYORIAS: Record<Mayoria, string> = {
  simple: "Mayoría simple de los asistentes",
  doble: "Mayoría absoluta (doble mayoría)",
  tres_quintos: "Tres quintos",
  unanimidad: "Unanimidad",
};

export const MAYORIAS_CORTO: Record<Mayoria, string> = {
  simple: "Mayoría simple",
  doble: "Mayoría absoluta",
  tres_quintos: "3/5",
  unanimidad: "Unanimidad",
};

export const SENTIDOS: Record<Sentido, string> = {
  favor: "A favor",
  contra: "En contra",
  abstencion: "Abstención",
};

/** Dias naturales que tienen los ausentes para oponerse (art. 17.8). */
export const DIAS_AUSENTES = 30;

export type ViviendaVoto = {
  fincaId: string;
  coeficiente: number;
  presente: boolean;
  sinVoto: boolean;
};

export type VotoVivienda = { sentido: Sentido; ausente: boolean };

export type Recuento = { viviendas: number; coeficiente: number };

export type EstadoVotacion = "aprobado" | "pendiente" | "rechazado" | "sin_votos";

export type ResultadoVotacion = {
  estado: EstadoVotacion;
  favor: Recuento;
  contra: Recuento;
  abstencion: Recuento;
  /** Presentes con voto que no han votado. */
  sinVotar: Recuento;
  /** Ausentes con voto que aun no han respondido. */
  ausentesSinRespuesta: Recuento;
  /** Base sobre la que se calcula la mayoria. */
  base: Recuento;
  /** Lo que hace falta a favor para aprobar. */
  necesario: { viviendas: number; coeficiente: number; estricto: boolean };
  cuentanAusentes: boolean;
};

function vacio(): Recuento {
  return { viviendas: 0, coeficiente: 0 };
}

function sumar(recuento: Recuento, coeficiente: number) {
  recuento.viviendas += 1;
  recuento.coeficiente += coeficiente;
}

// Margen para los decimales de los coeficientes (4 decimales en la base).
const EPSILON = 0.00005;

function alcanza(valor: number, umbral: number, estricto: boolean) {
  return estricto ? valor > umbral + EPSILON : valor >= umbral - EPSILON;
}

export function calcularVotacion(
  mayoria: Mayoria,
  viviendas: ViviendaVoto[],
  votos: Map<string, VotoVivienda>,
  plazoAusentesCumplido: boolean,
): ResultadoVotacion {
  const favor = vacio();
  const contra = vacio();
  const abstencion = vacio();
  const sinVotar = vacio();
  const ausentesSinRespuesta = vacio();
  const presentes = vacio();
  const total = vacio();
  const cuentanAusentes = mayoria !== "simple";

  for (const vivienda of viviendas) {
    if (vivienda.sinVoto) continue;
    sumar(total, vivienda.coeficiente);
    const voto = votos.get(vivienda.fincaId);

    if (vivienda.presente) {
      sumar(presentes, vivienda.coeficiente);
      if (!voto || voto.ausente) sumar(sinVotar, vivienda.coeficiente);
      else if (voto.sentido === "favor") sumar(favor, vivienda.coeficiente);
      else if (voto.sentido === "contra") sumar(contra, vivienda.coeficiente);
      else sumar(abstencion, vivienda.coeficiente);
      continue;
    }

    if (!cuentanAusentes) continue;
    if (voto?.ausente) {
      if (voto.sentido === "favor") sumar(favor, vivienda.coeficiente);
      else if (voto.sentido === "contra") sumar(contra, vivienda.coeficiente);
      else sumar(abstencion, vivienda.coeficiente);
    } else if (plazoAusentesCumplido) {
      // Ausente que no se ha opuesto en plazo: cuenta a favor (art. 17.8).
      sumar(favor, vivienda.coeficiente);
    } else {
      sumar(ausentesSinRespuesta, vivienda.coeficiente);
    }
  }

  const base = mayoria === "simple" ? presentes : total;
  const necesario =
    mayoria === "unanimidad"
      ? { viviendas: base.viviendas, coeficiente: base.coeficiente, estricto: false }
      : mayoria === "tres_quintos"
        ? { viviendas: (base.viviendas * 3) / 5, coeficiente: (base.coeficiente * 3) / 5, estricto: false }
        : { viviendas: base.viviendas / 2, coeficiente: base.coeficiente / 2, estricto: true };

  const aprueba = (recuento: Recuento) =>
    recuento.viviendas > 0 &&
    alcanza(recuento.viviendas, necesario.viviendas, necesario.estricto) &&
    alcanza(recuento.coeficiente, necesario.coeficiente, necesario.estricto);

  let estado: EstadoVotacion;
  if (favor.viviendas + contra.viviendas + abstencion.viviendas === 0) {
    estado = "sin_votos";
  } else if (aprueba(favor)) {
    estado = "aprobado";
  } else if (
    cuentanAusentes &&
    ausentesSinRespuesta.viviendas > 0 &&
    aprueba({
      viviendas: favor.viviendas + ausentesSinRespuesta.viviendas,
      coeficiente: favor.coeficiente + ausentesSinRespuesta.coeficiente,
    })
  ) {
    estado = "pendiente";
  } else {
    estado = "rechazado";
  }

  return { estado, favor, contra, abstencion, sinVotar, ausentesSinRespuesta, base, necesario, cuentanAusentes };
}

/** Ultimo dia del plazo de los ausentes, en formato AAAA-MM-DD. */
export function finPlazoAusentes(notificadaEn: string | null) {
  if (!notificadaEn) return null;
  const fecha = new Date(`${notificadaEn}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + DIAS_AUSENTES);
  return fecha.toISOString().slice(0, 10);
}

/** El plazo de 30 dias ha terminado si hoy es posterior al ultimo dia. */
export function plazoAusentesCumplido(notificadaEn: string | null, hoy: string) {
  const fin = finPlazoAusentes(notificadaEn);
  return fin !== null && hoy > fin;
}

export function formatoCoeficienteVoto(valor: number) {
  return `${valor.toLocaleString("es-ES", { maximumFractionDigits: 2 })} %`;
}
