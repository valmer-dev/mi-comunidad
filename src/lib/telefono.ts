/**
 * El telefono es el identificador principal de los vecinos. Supabase Auth
 * trabaja con correo, asi que para quien no tiene correo se genera uno interno
 * a partir del telefono. Nunca se muestra ni se envia nada a esa direccion.
 */
export const DOMINIO_TELEFONO = "telefono.micomunidad.local";

/** Deja solo los 9 digitos del numero espanol (acepta +34, 0034, espacios...). */
export function normalizarTelefono(valor: string) {
  let digitos = valor.replace(/\D/g, "");
  if (digitos.startsWith("0034")) digitos = digitos.slice(4);
  else if (digitos.length === 11 && digitos.startsWith("34")) digitos = digitos.slice(2);
  return digitos;
}

export function telefonoValido(valor: string) {
  return /^[6789]\d{8}$/.test(normalizarTelefono(valor));
}

export function formatearTelefono(valor: string | null | undefined) {
  if (!valor) return "—";
  const digitos = normalizarTelefono(valor);
  if (digitos.length !== 9) return valor;
  return `${digitos.slice(0, 3)} ${digitos.slice(3, 6)} ${digitos.slice(6)}`;
}

export function correoDesdeTelefono(valor: string) {
  return `${normalizarTelefono(valor)}@${DOMINIO_TELEFONO}`;
}

/** Detecta los correos internos generados a partir del telefono. */
export function esCorreoInterno(correo: string | null | undefined) {
  return Boolean(correo?.toLowerCase().endsWith(`@${DOMINIO_TELEFONO}`));
}

/** Acepta "600 000 000" o "ana@correo.com" y devuelve el correo de Auth. */
export function identificadorDesdeEntrada(valor: string) {
  const limpio = valor.trim();
  return limpio.includes("@") ? limpio.toLowerCase() : correoDesdeTelefono(limpio);
}
