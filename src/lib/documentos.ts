/** Categorias en las que se dividen los documentos de la comunidad. */
export const CATEGORIAS_DOCUMENTOS = [
  "Estatutos",
  "Actas",
  "Contratos",
  "Certificados",
  "Presupuestos",
] as const;

export type CategoriaDocumento = (typeof CATEGORIAS_DOCUMENTOS)[number];

export const DESCRIPCION_CATEGORIA: Record<CategoriaDocumento, string> = {
  Estatutos: "Normas y estatutos de la comunidad",
  Actas: "Actas de juntas y reuniones",
  Contratos: "Contratos de servicios y mantenimiento",
  Certificados: "Certificados y documentos oficiales",
  Presupuestos: "Presupuestos y ofertas de proveedores",
};

export function esCategoriaDocumento(valor: unknown): valor is CategoriaDocumento {
  return (
    typeof valor === "string" &&
    (CATEGORIAS_DOCUMENTOS as readonly string[]).includes(valor)
  );
}

/** Tamano maximo de cada PDF (25 MB). Coincide con el limite del bucket. */
export const TAMANO_MAXIMO_DOCUMENTO = 25 * 1024 * 1024;
