import type { crearClienteServidor } from "@/lib/supabase/servidor";

type ClienteServidor = Awaited<ReturnType<typeof crearClienteServidor>>;

/**
 * Reparte el 100 % de una finca a partes iguales entre todos sus titulares.
 * Se usa al mover o anadir titulares para que dos personas puedan compartir
 * la misma vivienda sin que los porcentajes se queden descuadrados.
 */
export async function repartirPorcentajes(
  supabase: ClienteServidor,
  fincaIds: string[],
) {
  for (const fincaId of fincaIds) {
    const { data: filas } = await supabase
      .from("titulares")
      .select("id")
      .eq("finca_id", fincaId)
      .order("creado_en", { ascending: true });

    if (!filas || filas.length === 0) continue;

    const base = Math.floor((100 / filas.length) * 100) / 100;
    let acumulado = 0;

    for (let indice = 0; indice < filas.length; indice += 1) {
      const esUltimo = indice === filas.length - 1;
      const porcentaje = esUltimo ? Number((100 - acumulado).toFixed(2)) : base;
      await supabase.from("titulares").update({ porcentaje }).eq("id", filas[indice].id);
      acumulado += porcentaje;
    }
  }
}
