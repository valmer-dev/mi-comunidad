import type { ModoAsistencia } from "@/lib/juntas";
import { calcularQuorum } from "@/lib/juntas";
import type { crearClienteServidor } from "@/lib/supabase/servidor";
import {
  calcularVotacion,
  plazoAusentesCumplido,
  type ResultadoVotacion,
  type Sentido,
  type VotoVivienda,
} from "@/lib/votaciones";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/** Dias naturales para cerrar y firmar el acta (art. 19.3 LPH). */
export const DIAS_FIRMA_ACTA = 10;

function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function sumarMeses(fecha: string, meses: number) {
  const d = new Date(`${fecha}T12:00:00Z`);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d.toISOString().slice(0, 10);
}

/** Dia de la junta en Madrid (AAAA-MM-DD). */
export function diaJunta(fechaHora: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date(fechaHora));
}

/** Ultimo dia para firmar el acta: 10 dias naturales tras la junta. */
export function limiteFirmaActa(fechaHora: string) {
  return sumarDias(diaJunta(fechaHora), DIAS_FIRMA_ACTA);
}

/**
 * Plazos para impugnar acuerdos (art. 18.3 LPH): 3 meses, o 1 año si el
 * acuerdo es contrario a la ley o a los estatutos. Para los presentes
 * cuentan desde la junta; para los ausentes, desde la notificacion del acta.
 */
export function plazosImpugnacion(fechaHora: string, notificadaEn: string | null) {
  const dia = diaJunta(fechaHora);
  return {
    presentes: { tresMeses: sumarMeses(dia, 3), unAno: sumarMeses(dia, 12) },
    ausentes: notificadaEn
      ? { tresMeses: sumarMeses(notificadaEn, 3), unAno: sumarMeses(notificadaEn, 12) }
      : null,
  };
}

export type PuntoActa = {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: "informativo" | "acuerdo" | "votacion";
  mayoria: "simple" | "doble" | "tres_quintos" | "unanimidad";
  resultado: string | null;
  votacion: ResultadoVotacion | null;
  contrarios: string[];
};

/**
 * Todo lo que lleva el acta de una junta con el contenido del art. 19.2 LPH:
 * fecha y lugar, quien convoca, caracter y convocatoria, asistentes con su
 * coeficiente, orden del dia y acuerdos con el resultado de la votacion y los
 * nombres de quienes votaron en contra.
 */
export async function cargarActa(
  supabase: Cliente,
  juntaId: string,
  comunidadId: string,
  coeficienteTotal: number,
  hoy: string,
) {
  const { data: junta } = await supabase
    .from("juntas")
    .select(
      "id, titulo, tipo, fecha_hora, lugar, estado, segunda_convocatoria_minutos, convocatoria_celebrada, acta_texto, acta_documento_id, acta_aprobada_en, acta_firmada_en, acta_notificada_en, celebrada_en",
    )
    .eq("id", juntaId)
    .eq("comunidad_id", comunidadId)
    .maybeSingle();
  if (!junta) return null;

  const [{ data: puntos }, { data: asistencias }, { data: fincas }, { data: morosos }, { data: cargos }] =
    await Promise.all([
      supabase
        .from("puntos_del_dia")
        .select("id, titulo, descripcion, tipo, mayoria_requerida, resultado")
        .eq("junta_id", junta.id)
        .order("posicion")
        .order("creado_en"),
      supabase.from("asistencias").select("finca_id, modo, representante_nombre, coeficiente").eq("junta_id", junta.id),
      supabase.from("fincas").select("id, codigo, coeficiente").eq("comunidad_id", comunidadId).order("tipo").order("numero"),
      supabase.rpc("morosos_junta", { p_junta_id: junta.id }),
      supabase
        .from("miembros")
        .select("rol, perfiles(nombre, apellidos)")
        .eq("comunidad_id", comunidadId)
        .eq("estado", "activo")
        .in("rol", ["presidente", "secretario"]),
    ]);

  const idsFincas = (fincas ?? []).map((f) => f.id);
  const idsPuntos = (puntos ?? []).filter((p) => p.tipo !== "informativo").map((p) => p.id);
  const [{ data: titulares }, { data: votos }] = await Promise.all([
    idsFincas.length
      ? supabase
          .from("titulares")
          .select("finca_id, nombre, perfiles(nombre, apellidos)")
          .in("finca_id", idsFincas)
          .is("hasta", null)
      : Promise.resolve({ data: [] as { finca_id: string; nombre: string | null; perfiles: { nombre: string; apellidos: string | null } | null }[] }),
    idsPuntos.length
      ? supabase.from("votos").select("punto_id, finca_id, sentido, ausente").in("punto_id", idsPuntos)
      : Promise.resolve({ data: [] as { punto_id: string; finca_id: string; sentido: Sentido; ausente: boolean }[] }),
  ]);

  const nombrePerfil = (perfil: { nombre: string; apellidos: string | null } | null | undefined) =>
    [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(" ");

  const nombresPorFinca = new Map<string, string[]>();
  for (const titular of titulares ?? []) {
    const nombre = titular.nombre?.trim() || nombrePerfil(titular.perfiles) || "Titular";
    nombresPorFinca.set(titular.finca_id, [...(nombresPorFinca.get(titular.finca_id) ?? []), nombre]);
  }

  const sinVoto = new Set((morosos ?? []).map((m) => m.finca_id));
  const asistenciaPorFinca = new Map((asistencias ?? []).map((a) => [a.finca_id, a]));
  const viviendas = (fincas ?? []).map((finca) => {
    const asistencia = asistenciaPorFinca.get(finca.id);
    return {
      fincaId: finca.id,
      codigo: finca.codigo,
      titulares: (nombresPorFinca.get(finca.id) ?? []).join(", "),
      coeficiente: Number(asistencia?.coeficiente ?? finca.coeficiente),
      modo: (asistencia?.modo ?? "ausente") as ModoAsistencia,
      representante: asistencia?.representante_nombre ?? "",
      sinVoto: sinVoto.has(finca.id),
    };
  });

  const votosPorPunto = new Map<string, Map<string, VotoVivienda>>();
  for (const voto of votos ?? []) {
    const mapa = votosPorPunto.get(voto.punto_id) ?? new Map<string, VotoVivienda>();
    mapa.set(voto.finca_id, { sentido: voto.sentido as Sentido, ausente: voto.ausente });
    votosPorPunto.set(voto.punto_id, mapa);
  }
  const viviendasVoto = viviendas.map((v) => ({
    fincaId: v.fincaId,
    coeficiente: v.coeficiente,
    presente: v.modo !== "ausente",
    sinVoto: v.sinVoto,
  }));
  const plazoCumplido = plazoAusentesCumplido(junta.acta_notificada_en, hoy);

  const puntosActa: PuntoActa[] = (puntos ?? []).map((punto) => {
    if (punto.tipo === "informativo") {
      return {
        id: punto.id,
        titulo: punto.titulo,
        descripcion: punto.descripcion,
        tipo: punto.tipo,
        mayoria: punto.mayoria_requerida,
        resultado: punto.resultado,
        votacion: null,
        contrarios: [],
      };
    }
    const mapa = votosPorPunto.get(punto.id) ?? new Map<string, VotoVivienda>();
    return {
      id: punto.id,
      titulo: punto.titulo,
      descripcion: punto.descripcion,
      tipo: punto.tipo,
      mayoria: punto.mayoria_requerida,
      resultado: punto.resultado,
      votacion: calcularVotacion(punto.mayoria_requerida, viviendasVoto, mapa, plazoCumplido),
      contrarios: viviendas
        .filter((v) => mapa.get(v.fincaId)?.sentido === "contra")
        .map((v) => `${v.codigo}${v.titulares ? ` (${v.titulares})` : ""}${mapa.get(v.fincaId)?.ausente ? ", ausente" : ""}`),
    };
  });

  const cargo = (rol: string) => nombrePerfil(cargos?.find((c) => c.rol === rol)?.perfiles) || null;

  return {
    junta,
    viviendas,
    asistentes: viviendas.filter((v) => v.modo !== "ausente"),
    quorum: calcularQuorum(
      viviendas,
      Object.fromEntries(viviendas.map((v) => [v.fincaId, v.modo])),
      coeficienteTotal,
    ),
    puntos: puntosActa,
    morosos: viviendas.filter((v) => v.sinVoto),
    presidente: cargo("presidente"),
    secretario: cargo("secretario"),
  };
}

export type DatosActa = NonNullable<Awaited<ReturnType<typeof cargarActa>>>;
