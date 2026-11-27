import type { ReciboConPagos } from "@/lib/recibos";
import type { crearClienteServidor } from "@/lib/supabase/servidor";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

export const COLUMNAS_RECIBO =
  "id, finca_id, periodo, concepto, importe, estado, vence_en, pagado_en, notas, pagos(id, importe, fecha, metodo, referencia)";

export type FincaResumen = {
  id: string;
  codigo: string;
  tipo: string;
  coeficiente: number;
  titulares: string[];
};

/** Fincas de la comunidad con el nombre de sus titulares. */
export async function cargarFincas(supabase: Cliente, comunidadId: string) {
  const { data: fincas } = await supabase
    .from("fincas")
    .select("id, codigo, tipo, numero, coeficiente")
    .eq("comunidad_id", comunidadId)
    .order("tipo")
    .order("numero")
    .order("codigo");

  const ids = (fincas ?? []).map((finca) => finca.id);
  const { data: titulares } = ids.length
    ? await supabase
        .from("titulares")
        .select("finca_id, nombre, perfiles(nombre, apellidos)")
        .in("finca_id", ids)
        .order("creado_en", { ascending: true })
    : { data: [] };

  const nombres = new Map<string, string[]>();
  for (const titular of titulares ?? []) {
    const perfil = titular.perfiles;
    const nombre =
      titular.nombre?.trim() ||
      [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(" ") ||
      "Titular";
    const lista = nombres.get(titular.finca_id) ?? [];
    lista.push(nombre);
    nombres.set(titular.finca_id, lista);
  }

  return (fincas ?? []).map<FincaResumen>((finca) => ({
    id: finca.id,
    codigo: finca.codigo,
    tipo: finca.tipo,
    coeficiente: Number(finca.coeficiente),
    titulares: nombres.get(finca.id) ?? [],
  }));
}

/** Normaliza lo que devuelve Supabase (numeric llega como number o string). */
export function normalizarRecibos(filas: unknown[] | null | undefined): ReciboConPagos[] {
  return ((filas ?? []) as ReciboConPagos[]).map((recibo) => ({
    ...recibo,
    importe: Number(recibo.importe),
    pagos: (recibo.pagos ?? []).map((pago) => ({ ...pago, importe: Number(pago.importe) })),
  }));
}
