/**
 * Vencimientos de los contratos con proveedores y de sus seguros.
 */

/** Dias de antelacion con los que se avisa de un vencimiento. */
export const DIAS_AVISO_CONTRATO = 60;

function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string) {
  return Math.round(
    (Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000,
  );
}

export type EstadoVencimiento =
  | { tipo: "sin_fecha" }
  | { tipo: "vigente"; fin: string }
  | { tipo: "proximo"; fin: string; dias: number; limitePreaviso: string | null }
  | { tipo: "vencido"; fin: string; dias: number };

/**
 * Estado de un contrato. Si tiene preaviso, el aviso empieza antes: hay que
 * comunicar la baja o la renegociacion antes de `fin - preaviso`.
 */
export function estadoContrato(
  fin: string | null,
  preavisoDias: number | null,
  hoy: string,
): EstadoVencimiento {
  if (!fin) return { tipo: "sin_fecha" };
  const dias = diasEntre(hoy, fin);
  if (dias < 0) return { tipo: "vencido", fin, dias: -dias };
  const limitePreaviso = preavisoDias ? sumarDias(fin, -preavisoDias) : null;
  if (dias <= DIAS_AVISO_CONTRATO + (preavisoDias ?? 0)) {
    return { tipo: "proximo", fin, dias, limitePreaviso };
  }
  return { tipo: "vigente", fin };
}

export function estadoSeguro(hasta: string | null, hoy: string) {
  return estadoContrato(hasta, null, hoy);
}
