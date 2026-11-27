/** Tipos de obligacion del calendario y plantillas habituales. */

export const CATEGORIAS_OBLIGACION = {
  inspeccion: "Inspección",
  mantenimiento: "Mantenimiento",
  fiscal: "Hacienda",
  seguro: "Seguro",
  junta: "Junta",
  otra: "Otra",
} as const;

export type CategoriaObligacion = keyof typeof CATEGORIAS_OBLIGACION;

/**
 * Obligaciones habituales de una comunidad para darlas de alta con un clic.
 * Los plazos legales cambian segun la comunidad autonoma y el municipio, por
 * eso la descripcion pide confirmarlos.
 */
export const PLANTILLAS_OBLIGACION: {
  titulo: string;
  categoria: CategoriaObligacion;
  cadaMeses: number | null;
  descripcion: string;
}[] = [
  {
    titulo: "Inspección técnica del edificio (ITE/IEE)",
    categoria: "inspeccion",
    cadaMeses: 120,
    descripcion:
      "Obligatoria en edificios a partir de cierta antigüedad. El plazo y la periodicidad dependen del ayuntamiento y la comunidad autónoma.",
  },
  {
    titulo: "Inspección periódica del ascensor",
    categoria: "inspeccion",
    cadaMeses: 48,
    descripcion:
      "La hace un organismo de control (OCA), cada 2, 4 o 6 años según el edificio. Confirma la fecha con la empresa de mantenimiento.",
  },
  {
    titulo: "Revisión de extintores y protección contra incendios",
    categoria: "mantenimiento",
    cadaMeses: 12,
    descripcion: "Revisión anual por una empresa mantenedora autorizada.",
  },
  {
    titulo: "Inspección de la instalación común de gas",
    categoria: "inspeccion",
    cadaMeses: 60,
    descripcion: "Inspección periódica de la instalación común, si el edificio tiene gas canalizado.",
  },
  {
    titulo: "Inspección de baja tensión del garaje",
    categoria: "inspeccion",
    cadaMeses: 60,
    descripcion: "Si el garaje la necesita por su tamaño o ventilación. Confírmalo con el instalador.",
  },
  {
    titulo: "Modelo 347 a Hacienda",
    categoria: "fiscal",
    cadaMeses: 12,
    descripcion:
      "Declaración anual, en febrero, de los proveedores a los que se han pagado más de 3.005,06 € en el año.",
  },
  {
    titulo: "Renovación del seguro de la comunidad",
    categoria: "seguro",
    cadaMeses: 12,
    descripcion: "Revisa coberturas y precio antes de que se renueve.",
  },
  {
    titulo: "Desinsectación y desratización",
    categoria: "mantenimiento",
    cadaMeses: 12,
    descripcion: "Tratamiento periódico de zonas comunes, garaje y cuartos de basura.",
  },
];

