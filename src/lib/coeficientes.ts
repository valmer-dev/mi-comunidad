/**
 * Coeficientes de participacion (cuota de la LPH). Se guardan con cuatro
 * decimales y, entre todas las fincas, deben sumar el coeficiente total de la
 * comunidad (normalmente 100).
 *
 * Para no arrastrar errores de coma flotante se trabaja en diezmilesimas
 * enteras: 12,3456 % son 123456.
 */

export const DECIMALES_COEFICIENTE = 4;
const ESCALA = 10 ** DECIMALES_COEFICIENTE;

/** Convierte "12,5" o "12.5" en diezmilesimas (125000). null si no es valido. */
export function aDiezmilesimas(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim().replace(/\s/g, "").replace(",", ".");
  if (texto === "") return null;
  if (!/^\d+(\.\d+)?$/.test(texto)) return null;
  const [entero, decimales = ""] = texto.split(".");
  if (decimales.length > DECIMALES_COEFICIENTE) return null;
  return Number(entero) * ESCALA + Number(decimales.padEnd(DECIMALES_COEFICIENTE, "0"));
}

/** Diezmilesimas a numero con cuatro decimales (125000 -> 12.5). */
export function deDiezmilesimas(valor: number) {
  return valor / ESCALA;
}

/** Texto en formato espanol con hasta cuatro decimales: 12,5 · 8,3333. */
export function formatoCoeficiente(valor: number | string | null | undefined) {
  const numero = Number(valor ?? 0);
  return numero.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: DECIMALES_COEFICIENTE,
  });
}

/** Suma de coeficientes en diezmilesimas; null si alguno no es valido. */
export function sumarCoeficientes(valores: (string | number | null | undefined)[]) {
  let total = 0;
  for (const valor of valores) {
    const diezmilesimas = aDiezmilesimas(valor);
    if (diezmilesimas === null) return null;
    total += diezmilesimas;
  }
  return total;
}
