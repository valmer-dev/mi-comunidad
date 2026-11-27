import type { crearClienteServidor } from "@/lib/supabase/servidor";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/**
 * Todo lo que lleva la convocatoria de una junta: datos de la junta, orden
 * del dia, quien convoca (el presidente) y la relacion de propietarios que no
 * estan al corriente (art. 16.2 LPH).
 */
export async function cargarConvocatoria(supabase: Cliente, juntaId: string, comunidadId: string) {
  const { data: junta } = await supabase
    .from("juntas")
    .select(
      "id, titulo, tipo, fecha_hora, lugar, estado, segunda_convocatoria_minutos, convocatoria_enviada_en, convocatoria_medios, convocatoria_anuncio_id",
    )
    .eq("id", juntaId)
    .eq("comunidad_id", comunidadId)
    .maybeSingle();
  if (!junta) return null;

  const [{ data: puntos }, { data: morosos }, { data: presidentes }] = await Promise.all([
    supabase
      .from("puntos_del_dia")
      .select("id, titulo, descripcion")
      .eq("junta_id", junta.id)
      .order("posicion")
      .order("creado_en"),
    supabase.rpc("morosos_junta", { p_junta_id: junta.id }),
    supabase
      .from("miembros")
      .select("usuario_id, perfiles(nombre, apellidos)")
      .eq("comunidad_id", comunidadId)
      .eq("rol", "presidente")
      .eq("estado", "activo")
      .limit(1),
  ]);

  const idsMorosos = (morosos ?? []).map((moroso) => moroso.finca_id);
  const { data: titulares } = idsMorosos.length
    ? await supabase
        .from("titulares")
        .select("finca_id, nombre, perfiles(nombre, apellidos)")
        .in("finca_id", idsMorosos)
        .is("hasta", null)
    : { data: [] };

  const nombres = new Map<string, string[]>();
  for (const titular of titulares ?? []) {
    const perfil = titular.perfiles;
    const nombre =
      titular.nombre?.trim() ||
      [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(" ") ||
      "Titular";
    nombres.set(titular.finca_id, [...(nombres.get(titular.finca_id) ?? []), nombre]);
  }

  const perfilPresidente = presidentes?.[0]?.perfiles;
  const presidente =
    [perfilPresidente?.nombre, perfilPresidente?.apellidos].filter(Boolean).join(" ") || null;

  return {
    junta,
    puntos: puntos ?? [],
    morosos: (morosos ?? []).map((moroso) => ({
      fincaId: moroso.finca_id,
      codigo: moroso.codigo,
      titulares: nombres.get(moroso.finca_id) ?? [],
    })),
    presidente,
  };
}

export type DatosConvocatoria = NonNullable<Awaited<ReturnType<typeof cargarConvocatoria>>>;
