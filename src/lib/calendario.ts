import { limiteCertificado } from "@/lib/certificados";
import { diaJunta, limiteFirmaActa } from "@/lib/datos-acta";
import { estadoContrato } from "@/lib/proveedores";
import type { crearClienteServidor } from "@/lib/supabase/servidor";
import { finPlazoAusentes } from "@/lib/votaciones";
import { CATEGORIAS_OBLIGACION, type CategoriaObligacion } from "@/lib/obligaciones";

export { CATEGORIAS_OBLIGACION, PLANTILLAS_OBLIGACION, type CategoriaObligacion } from "@/lib/obligaciones";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

export type CategoriaEvento = CategoriaObligacion | "contrato" | "documento" | "cobro";

export const ETIQUETAS_EVENTO: Record<CategoriaEvento, string> = {
  ...CATEGORIAS_OBLIGACION,
  contrato: "Contrato",
  documento: "Documento",
  cobro: "Cobro",
};

export type Evento = {
  id: string;
  fecha: string;
  titulo: string;
  detalle: string | null;
  categoria: CategoriaEvento;
  href: string | null;
  /** Dias de antelacion con los que conviene verlo. */
  avisoDias: number;
  /** Solo las obligaciones se pueden marcar como hechas o borrar. */
  obligacion: { id: string; cadaMeses: number | null; ultimaVez: string | null } | null;
};

function sumarMeses(fecha: string, meses: number) {
  const d = new Date(`${fecha}T12:00:00Z`);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d.toISOString().slice(0, 10);
}

/**
 * Todo lo que vence en la comunidad: obligaciones dadas de alta, contratos y
 * seguros de proveedores, documentos que caducan, plazos de derramas, juntas
 * convocadas, actas por firmar, plazo de los ausentes y la junta ordinaria
 * anual (art. 16.1 LPH).
 */
export async function cargarCalendario(supabase: Cliente, comunidadId: string, hoy: string) {
  const [
    { data: obligaciones },
    { data: proveedores },
    { data: documentos },
    { data: plazos },
    { data: juntas },
    { data: presupuestos },
    { data: certificados },
  ] = await Promise.all([
    supabase
      .from("obligaciones")
      .select("id, titulo, descripcion, categoria, fecha, cada_meses, aviso_dias, proveedor_id, ultima_vez")
      .eq("comunidad_id", comunidadId)
      .is("completada_en", null)
      .order("fecha"),
    supabase
      .from("proveedores")
      .select("id, nombre, categoria, contrato_fin, preaviso_dias, renovacion_automatica, seguro_hasta")
      .eq("comunidad_id", comunidadId),
    supabase
      .from("documentos")
      .select("id, nombre, caduca_en")
      .eq("comunidad_id", comunidadId)
      .not("caduca_en", "is", null),
    supabase
      .from("recibos")
      .select("derrama_id, vence_en, importe, derramas(titulo, anulada_en)")
      .eq("comunidad_id", comunidadId)
      .not("derrama_id", "is", null)
      .gte("vence_en", hoy)
      .neq("estado", "anulado"),
    supabase
      .from("juntas")
      .select("id, titulo, tipo, estado, fecha_hora, acta_firmada_en, acta_notificada_en")
      .eq("comunidad_id", comunidadId)
      .order("fecha_hora", { ascending: false }),
    supabase.from("presupuestos").select("ejercicio, estado").eq("comunidad_id", comunidadId),
    supabase
      .from("certificados_deuda")
      .select("id, finca_id, solicitante, solicitado_en, fincas(codigo)")
      .eq("comunidad_id", comunidadId)
      .is("emitido_en", null),
  ]);

  const eventos: Evento[] = [];
  const nombreProveedor = new Map((proveedores ?? []).map((p) => [p.id, p.nombre]));

  for (const o of obligaciones ?? []) {
    eventos.push({
      id: `obligacion-${o.id}`,
      fecha: o.fecha,
      titulo: o.titulo,
      detalle:
        [o.proveedor_id ? nombreProveedor.get(o.proveedor_id) : null, o.descripcion].filter(Boolean).join(" · ") || null,
      categoria: (o.categoria in CATEGORIAS_OBLIGACION ? o.categoria : "otra") as CategoriaObligacion,
      href: null,
      avisoDias: o.aviso_dias,
      obligacion: { id: o.id, cadaMeses: o.cada_meses, ultimaVez: o.ultima_vez },
    });
  }

  for (const p of proveedores ?? []) {
    const nombre = `${p.categoria || "Servicio"} (${p.nombre})`;
    if (p.contrato_fin) {
      const estado = estadoContrato(p.contrato_fin, p.preaviso_dias, hoy);
      if (estado.tipo === "proximo" && estado.limitePreaviso && estado.limitePreaviso >= hoy) {
        eventos.push({
          id: `preaviso-${p.id}`,
          fecha: estado.limitePreaviso,
          titulo: `Último día para avisar si no se renueva: ${nombre}`,
          detalle: p.renovacion_automatica ? "Se renueva solo si no se avisa." : null,
          categoria: "contrato",
          href: `/servicios#servicio-${p.id}`,
          avisoDias: 30,
          obligacion: null,
        });
      }
      eventos.push({
        id: `contrato-${p.id}`,
        fecha: p.contrato_fin,
        titulo: `Fin del contrato: ${nombre}`,
        detalle: p.renovacion_automatica ? "Se renueva solo." : null,
        categoria: "contrato",
        href: `/servicios#servicio-${p.id}`,
        avisoDias: 60 + (p.preaviso_dias ?? 0),
        obligacion: null,
      });
    }
    if (p.seguro_hasta) {
      eventos.push({
        id: `seguro-${p.id}`,
        fecha: p.seguro_hasta,
        titulo: `Vence el seguro de ${nombre}`,
        detalle: "Pide el certificado del seguro renovado.",
        categoria: "seguro",
        href: `/servicios#servicio-${p.id}`,
        avisoDias: 30,
        obligacion: null,
      });
    }
  }

  for (const d of documentos ?? []) {
    if (!d.caduca_en) continue;
    eventos.push({
      id: `documento-${d.id}`,
      fecha: d.caduca_en,
      titulo: `Caduca: ${d.nombre}`,
      detalle: null,
      categoria: "documento",
      href: "/documentos",
      avisoDias: 30,
      obligacion: null,
    });
  }

  // Un evento por plazo de derrama, con lo que se emite.
  const porPlazo = new Map<string, { titulo: string; fecha: string; total: number; derramaId: string }>();
  for (const r of plazos ?? []) {
    if (!r.derrama_id || !r.vence_en || r.derramas?.anulada_en) continue;
    const clave = `${r.derrama_id}-${r.vence_en}`;
    const actual = porPlazo.get(clave) ?? {
      titulo: r.derramas?.titulo ?? "Derrama",
      fecha: r.vence_en,
      total: 0,
      derramaId: r.derrama_id,
    };
    actual.total += Number(r.importe);
    porPlazo.set(clave, actual);
  }
  for (const [clave, p] of porPlazo) {
    eventos.push({
      id: `derrama-${clave}`,
      fecha: p.fecha,
      titulo: `Vence un plazo de la derrama «${p.titulo}»`,
      detalle: `${p.total.toLocaleString("es-ES", { style: "currency", currency: "EUR" })} entre todas las viviendas`,
      categoria: "cobro",
      href: `/finanzas/derramas#derrama-${p.derramaId}`,
      avisoDias: 15,
      obligacion: null,
    });
  }

  for (const j of juntas ?? []) {
    const dia = diaJunta(j.fecha_hora);
    if ((j.estado === "convocada" || j.estado === "borrador") && dia >= hoy) {
      eventos.push({
        id: `junta-${j.id}`,
        fecha: dia,
        titulo: `${j.estado === "borrador" ? "Junta en borrador" : "Junta"}: ${j.titulo}`,
        detalle: j.estado === "borrador" ? "Todavía no se ha enviado la convocatoria." : null,
        categoria: "junta",
        href: `/juntas/${j.id}`,
        avisoDias: 30,
        obligacion: null,
      });
    }
    if (j.estado === "celebrada" && !j.acta_firmada_en) {
      eventos.push({
        id: `acta-${j.id}`,
        fecha: limiteFirmaActa(j.fecha_hora),
        titulo: `Cerrar y firmar el acta: ${j.titulo}`,
        detalle: "Diez días naturales desde la junta (art. 19.3 LPH).",
        categoria: "junta",
        href: `/juntas/${j.id}`,
        avisoDias: 10,
        obligacion: null,
      });
    }
    const finAusentes = finPlazoAusentes(j.acta_notificada_en);
    if (finAusentes && finAusentes >= hoy) {
      eventos.push({
        id: `ausentes-${j.id}`,
        fecha: finAusentes,
        titulo: `Termina el plazo de los ausentes: ${j.titulo}`,
        detalle: "Después, quien no se ha opuesto cuenta a favor (art. 17.8 LPH).",
        categoria: "junta",
        href: `/juntas/${j.id}`,
        avisoDias: 30,
        obligacion: null,
      });
    }
  }

  for (const c of certificados ?? []) {
    eventos.push({
      id: `certificado-${c.id}`,
      fecha: limiteCertificado(c.solicitado_en),
      titulo: `Emitir el certificado de deuda de ${c.fincas?.codigo ?? "la vivienda"}`,
      detalle: `Lo pidió ${c.solicitante}. Siete días naturales desde la solicitud (art. 9.1.e LPH).`,
      categoria: "cobro",
      href: `/finanzas/recibos/${c.finca_id}`,
      avisoDias: 7,
      obligacion: null,
    });
  }

  // Junta ordinaria anual para aprobar presupuesto y cuentas (art. 16.1 LPH).
  const ordinarias = (juntas ?? []).filter((j) => j.tipo === "ordinaria");
  const proximaOrdinaria = ordinarias.find(
    (j) => (j.estado === "convocada" || j.estado === "borrador") && diaJunta(j.fecha_hora) >= hoy,
  );
  const ultimaOrdinaria = ordinarias.find((j) => j.estado === "celebrada" || j.estado === "cerrada");
  if (!proximaOrdinaria) {
    const fecha = ultimaOrdinaria ? sumarMeses(diaJunta(ultimaOrdinaria.fecha_hora), 12) : hoy;
    eventos.push({
      id: "junta-ordinaria-anual",
      fecha,
      titulo: "Celebrar la junta ordinaria anual",
      detalle: ultimaOrdinaria
        ? "Al menos una vez al año, para aprobar el presupuesto y las cuentas (art. 16.1 LPH)."
        : "No consta ninguna junta ordinaria. Hay que celebrarla al menos una vez al año (art. 16.1 LPH).",
      categoria: "junta",
      href: "/juntas",
      avisoDias: 60,
      obligacion: null,
    });
  }

  const ejercicio = Number(hoy.slice(0, 4));
  const aprobado = (presupuestos ?? []).some((p) => p.ejercicio === ejercicio && p.estado !== "borrador");
  if (!aprobado) {
    eventos.push({
      id: `presupuesto-${ejercicio}`,
      fecha: proximaOrdinaria ? diaJunta(proximaOrdinaria.fecha_hora) : `${ejercicio}-12-31`,
      titulo: `Aprobar el presupuesto de ${ejercicio}`,
      detalle: proximaOrdinaria ? "Llévalo a la próxima junta ordinaria." : "Todavía no hay presupuesto aprobado para este año.",
      categoria: "junta",
      href: "/finanzas/presupuesto",
      avisoDias: 60,
      obligacion: null,
    });
  }

  return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.titulo.localeCompare(b.titulo));
}
