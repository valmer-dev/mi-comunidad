/** Quien paga el arreglo de una incidencia. */
export const RESPONSABLES = {
  comunidad: "La comunidad",
  privativo: "El propietario de la vivienda (privativo)",
  por_determinar: "Por determinar",
} as const;

export type Responsable = keyof typeof RESPONSABLES;

/** Estado del parte al seguro de la comunidad. */
export const ESTADOS_SEGURO = {
  comunicado: "Parte comunicado",
  peritado: "Peritado",
  indemnizado: "Indemnizado",
  rechazado: "Rechazado por el seguro",
} as const;

export type EstadoSeguro = keyof typeof ESTADOS_SEGURO;
