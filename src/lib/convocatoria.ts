/**
 * Convocatoria de juntas (art. 16 LPH).
 *
 * La junta ordinaria se convoca con al menos 6 dias de antelacion; la
 * extraordinaria, con la antelacion que permita que llegue a todos. Los dias
 * se cuentan como naturales entre el envio y el dia de la junta, en hora de
 * Madrid.
 */

export const DIAS_MINIMOS_ORDINARIA = 6;

export const MEDIOS_CONVOCATORIA = {
  tablon: "Tablón de la app",
  correo: "Correo electrónico",
  papel: "Papel o buzón",
} as const;

export type MedioConvocatoria = keyof typeof MEDIOS_CONVOCATORIA;

/** Fecha AAAA-MM-DD en hora de Madrid. */
export function diaMadrid(fecha: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(
    typeof fecha === "string" ? new Date(fecha) : fecha,
  );
}

/** Dias naturales entre dos fechas AAAA-MM-DD. */
export function diasEntre(desde: string, hasta: string) {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

/**
 * Antelacion de la convocatoria: la real si ya se envio, o la que quedaria
 * si se envia hoy.
 */
export function antelacion({
  tipo,
  fechaJunta,
  enviadaEn,
  ahora = new Date(),
}: {
  tipo: string;
  fechaJunta: string;
  enviadaEn: string | null;
  ahora?: Date;
}) {
  const dias = diasEntre(diaMadrid(enviadaEn ?? ahora), diaMadrid(fechaJunta));
  const ordinaria = tipo === "ordinaria";
  return {
    dias,
    enviada: Boolean(enviadaEn),
    // La extraordinaria no tiene minimo fijo: se avisa si es el mismo dia o antes
    cumple: ordinaria ? dias >= DIAS_MINIMOS_ORDINARIA : dias >= 1,
    ordinaria,
  };
}

/** Escapa texto para meterlo en el HTML de un anuncio. */
export function escaparHtml(texto: string) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
