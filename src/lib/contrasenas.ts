import { randomInt } from "node:crypto";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/**
 * Contrasena temporal para entregar en mano. Evita caracteres ambiguos
 * (0/O, 1/l/I) para que se pueda dictar por telefono sin errores.
 */
export function generarContrasenaTemporal(longitud = 10) {
  let resultado = "";
  for (let i = 0; i < longitud; i++) {
    resultado += ALFABETO[randomInt(ALFABETO.length)];
  }
  return resultado;
}
