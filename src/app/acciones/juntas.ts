"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { enviarAvisosDespues } from "@/lib/correo";
import { TAMANO_MAXIMO_DOCUMENTO } from "@/lib/documentos";
import { esAdministrador } from "@/lib/permisos";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const esquema = z.object({
  titulo: z.string().trim().min(3, "El título es demasiado corto."),
  tipo: z.enum(["ordinaria", "extraordinaria"]),
  fecha: z.string().min(1, "Indica la fecha y la hora."),
  lugar: z.string().trim().optional(),
  puntos: z.string().trim().optional(),
});

export type EstadoJunta = { error?: string; ok?: boolean };

export async function crearJunta(
  _estado: EstadoJunta,
  datos: FormData,
): Promise<EstadoJunta> {
  const { usuario, comunidad, permisos } = await requerirContexto();
  if (!esAdministrador(permisos)) {
    return { error: "Solo la junta directiva puede convocar juntas." };
  }

  const resultado = esquema.safeParse({
    titulo: datos.get("titulo"),
    tipo: datos.get("tipo"),
    fecha: datos.get("fecha"),
    lugar: datos.get("lugar") || undefined,
    puntos: datos.get("puntos") || undefined,
  });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const fecha = new Date(resultado.data.fecha);
  if (Number.isNaN(fecha.getTime())) {
    return { error: "La fecha no es válida." };
  }

  const supabase = await crearClienteServidor();

  const { data: junta, error } = await supabase
    .from("juntas")
    .insert({
      comunidad_id: comunidad.id,
      titulo: resultado.data.titulo,
      tipo: resultado.data.tipo,
      fecha_hora: fecha.toISOString(),
      lugar: resultado.data.lugar ?? null,
      estado: "convocada",
      creada_por: usuario.id,
    })
    .select("id")
    .single();

  if (error || !junta) {
    return { error: "No se pudo crear la junta." };
  }

  const lineas = (resultado.data.puntos ?? "")
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean);

  if (lineas.length > 0) {
    await supabase.from("puntos_del_dia").insert(
      lineas.map((titulo, indice) => ({
        junta_id: junta.id,
        posicion: indice + 1,
        titulo,
        tipo: "acuerdo" as const,
      })),
    );
  }

  revalidatePath("/juntas");
  revalidatePath("/panel");
  return { ok: true };
}

/** Elimina una junta y todo su contenido (puntos del día y asistencias). */
export async function eliminarJunta(
  _estado: EstadoJunta,
  datos: FormData,
): Promise<EstadoJunta> {
  const { comunidad, permisos } = await requerirContexto();

  if (!esAdministrador(permisos)) {
    return { error: "Solo la junta directiva puede eliminar juntas." };
  }

  const id = String(datos.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) {
    return { error: "Junta no válida." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("juntas")
    .delete()
    .eq("id", id)
    .eq("comunidad_id", comunidad.id);

  if (error) {
    return { error: "No se pudo eliminar la junta. Inténtalo de nuevo." };
  }

  revalidatePath("/juntas");
  revalidatePath("/panel");
  return { ok: true };
}

// ------------------------------------------------------------
// Detalle de la junta: orden del día, asistencia, acuerdos y acta
// ------------------------------------------------------------

const esquemaUuid = z.string().uuid();

/** Comprueba el permiso y que la junta es de la comunidad activa. */
async function juntaAdministrable(juntaId: unknown) {
  const contexto = await requerirContexto();
  if (!esAdministrador(contexto.permisos)) {
    return { error: "Solo la junta directiva puede editar juntas." } as const;
  }

  const id = String(juntaId ?? "");
  if (!esquemaUuid.safeParse(id).success) {
    return { error: "Junta no válida." } as const;
  }

  const supabase = await crearClienteServidor();
  const { data: junta } = await supabase
    .from("juntas")
    .select("id, estado, acta_documento_id")
    .eq("id", id)
    .eq("comunidad_id", contexto.comunidad.id)
    .maybeSingle();

  if (!junta) return { error: "No se encontró la junta." } as const;
  return { ...contexto, supabase, junta } as const;
}

function revalidarJunta(id: string) {
  revalidatePath("/juntas");
  revalidatePath(`/juntas/${id}`);
  revalidatePath("/panel");
}

const esquemaPunto = z.object({
  titulo: z.string().trim().min(2, "El título del punto es demasiado corto.").max(200),
  descripcion: z.string().trim().max(2000).optional(),
  tipo: z.enum(["informativo", "acuerdo", "votacion"]),
  mayoria: z.enum(["simple", "doble", "unanimidad"]),
});

/** Crea un punto nuevo (sin punto_id) o edita uno existente. */
export async function guardarPunto(
  _estado: EstadoJunta,
  datos: FormData,
): Promise<EstadoJunta> {
  const contexto = await juntaAdministrable(datos.get("junta_id"));
  if ("error" in contexto) return { error: contexto.error };
  const { supabase, junta } = contexto;

  const resultado = esquemaPunto.safeParse({
    titulo: datos.get("titulo"),
    descripcion: datos.get("descripcion") || undefined,
    tipo: datos.get("tipo") || "acuerdo",
    mayoria: datos.get("mayoria") || "simple",
  });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const campos = {
    titulo: resultado.data.titulo,
    descripcion: resultado.data.descripcion ?? null,
    tipo: resultado.data.tipo,
    mayoria_requerida: resultado.data.mayoria,
  };

  const puntoId = String(datos.get("punto_id") ?? "");
  if (puntoId) {
    if (!esquemaUuid.safeParse(puntoId).success) return { error: "Punto no válido." };
    const { error } = await supabase
      .from("puntos_del_dia")
      .update(campos)
      .eq("id", puntoId)
      .eq("junta_id", junta.id);
    if (error) return { error: "No se pudo guardar el punto." };
  } else {
    const { data: ultimo } = await supabase
      .from("puntos_del_dia")
      .select("posicion")
      .eq("junta_id", junta.id)
      .order("posicion", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("puntos_del_dia").insert({
      ...campos,
      junta_id: junta.id,
      posicion: (ultimo?.posicion ?? 0) + 1,
    });
    if (error) return { error: "No se pudo añadir el punto." };
  }

  revalidarJunta(junta.id);
  return { ok: true };
}

/** Quita un punto y renumera los demás. */
export async function eliminarPunto(
  _estado: EstadoJunta,
  datos: FormData,
): Promise<EstadoJunta> {
  const contexto = await juntaAdministrable(datos.get("junta_id"));
  if ("error" in contexto) return { error: contexto.error };
  const { supabase, junta } = contexto;

  const puntoId = String(datos.get("id") ?? "");
  if (!esquemaUuid.safeParse(puntoId).success) return { error: "Punto no válido." };

  const { error } = await supabase
    .from("puntos_del_dia")
    .delete()
    .eq("id", puntoId)
    .eq("junta_id", junta.id);
  if (error) return { error: "No se pudo quitar el punto." };

  await renumerarPuntos(supabase, junta.id);
  revalidarJunta(junta.id);
  return { ok: true };
}

/** Sube o baja un punto una posición. */
export async function moverPunto(
  _estado: EstadoJunta,
  datos: FormData,
): Promise<EstadoJunta> {
  const contexto = await juntaAdministrable(datos.get("junta_id"));
  if ("error" in contexto) return { error: contexto.error };
  const { supabase, junta } = contexto;

  const puntoId = String(datos.get("id") ?? "");
  const direccion = datos.get("direccion") === "arriba" ? -1 : 1;

  const { data: puntos } = await supabase
    .from("puntos_del_dia")
    .select("id, posicion")
    .eq("junta_id", junta.id)
    .order("posicion")
    .order("creado_en");

  const lista = puntos ?? [];
  const indice = lista.findIndex((p) => p.id === puntoId);
  const destino = indice + direccion;
  if (indice < 0 || destino < 0 || destino >= lista.length) return { ok: true };

  [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
  for (let i = 0; i < lista.length; i += 1) {
    if (lista[i].posicion !== i + 1) {
      await supabase.from("puntos_del_dia").update({ posicion: i + 1 }).eq("id", lista[i].id);
    }
  }

  revalidarJunta(junta.id);
  return { ok: true };
}

async function renumerarPuntos(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  juntaId: string,
) {
  const { data: puntos } = await supabase
    .from("puntos_del_dia")
    .select("id, posicion")
    .eq("junta_id", juntaId)
    .order("posicion")
    .order("creado_en");
  for (const [i, punto] of (puntos ?? []).entries()) {
    if (punto.posicion !== i + 1) {
      await supabase.from("puntos_del_dia").update({ posicion: i + 1 }).eq("id", punto.id);
    }
  }
}

const MODOS = ["presencial", "representado", "ausente"] as const;

/**
 * Guarda la lista de asistencia. El formulario envía, por cada vivienda,
 * `modo_<finca>` y, si viene representada, `representante_<finca>`.
 * El coeficiente lo copia la base de datos desde la vivienda.
 */
export async function guardarAsistencia(
  _estado: EstadoJunta,
  datos: FormData,
): Promise<EstadoJunta> {
  const contexto = await juntaAdministrable(datos.get("junta_id"));
  if ("error" in contexto) return { error: contexto.error };
  const { supabase, junta, usuario, comunidad } = contexto;

  const { data: fincas } = await supabase
    .from("fincas")
    .select("id")
    .eq("comunidad_id", comunidad.id);

  const filas = [];
  for (const finca of fincas ?? []) {
    const modo = String(datos.get(`modo_${finca.id}`) ?? "ausente");
    if (!(MODOS as readonly string[]).includes(modo)) {
      return { error: "Hay un modo de asistencia no válido." };
    }
    const representante = String(datos.get(`representante_${finca.id}`) ?? "").trim();
    filas.push({
      junta_id: junta.id,
      finca_id: finca.id,
      modo: modo as (typeof MODOS)[number],
      representante_nombre: modo === "representado" ? representante.slice(0, 120) || null : null,
      registrado_por: usuario.id,
    });
  }

  if (filas.length > 0) {
    const { error } = await supabase
      .from("asistencias")
      .upsert(filas, { onConflict: "junta_id,finca_id" });
    if (error) return { error: "No se pudo guardar la asistencia." };
  }

  revalidarJunta(junta.id);
  return { ok: true };
}

function numeroOpcional(valor: FormDataEntryValue | null) {
  const texto = String(valor ?? "").trim().replace(",", ".");
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) && numero >= 0 ? numero : Number.NaN;
}

/** Guarda el acuerdo y el recuento de cada punto del día. */
export async function guardarAcuerdos(
  _estado: EstadoJunta,
  datos: FormData,
): Promise<EstadoJunta> {
  const contexto = await juntaAdministrable(datos.get("junta_id"));
  if ("error" in contexto) return { error: contexto.error };
  const { supabase, junta } = contexto;

  const { data: puntos } = await supabase
    .from("puntos_del_dia")
    .select("id")
    .eq("junta_id", junta.id);

  for (const punto of puntos ?? []) {
    const resultado = String(datos.get(`resultado_${punto.id}`) ?? "").trim().slice(0, 4000);
    const favor = numeroOpcional(datos.get(`favor_${punto.id}`));
    const contra = numeroOpcional(datos.get(`contra_${punto.id}`));
    const abstenciones = numeroOpcional(datos.get(`abstenciones_${punto.id}`));
    if ([favor, contra, abstenciones].some((n) => Number.isNaN(n))) {
      return { error: "Los votos deben ser números positivos (suma de coeficientes)." };
    }
    const { error } = await supabase
      .from("puntos_del_dia")
      .update({
        resultado: resultado || null,
        votos_favor: favor,
        votos_contra: contra,
        abstenciones,
      })
      .eq("id", punto.id);
    if (error) return { error: "No se pudieron guardar los acuerdos." };
  }

  revalidarJunta(junta.id);
  return { ok: true };
}

const TRANSICIONES = {
  convocada: ["celebrada"],
  celebrada: ["convocada", "cerrada"],
  cerrada: ["celebrada"],
  borrador: ["convocada"],
} as const satisfies Record<string, readonly string[]>;

/** Avanza (o deshace) el estado: convocada → celebrada → cerrada. */
export async function cambiarEstadoJunta(
  _estado: EstadoJunta,
  datos: FormData,
): Promise<EstadoJunta> {
  const contexto = await juntaAdministrable(datos.get("junta_id"));
  if ("error" in contexto) return { error: contexto.error };
  const { supabase, junta } = contexto;

  const nuevo = String(datos.get("estado") ?? "");
  const permitidos: readonly string[] = TRANSICIONES[junta.estado];
  if (!permitidos.includes(nuevo)) return { error: "Ese cambio de estado no es posible." };

  if (nuevo === "cerrada" && !junta.acta_documento_id) {
    return { error: "Sube el PDF del acta antes de cerrar la junta." };
  }

  const estado = nuevo as "convocada" | "celebrada" | "cerrada";
  const { error } = await supabase
    .from("juntas")
    .update({
      estado,
      ...(estado === "celebrada" && junta.estado === "convocada"
        ? { celebrada_en: new Date().toISOString() }
        : {}),
      ...(estado === "convocada" ? { celebrada_en: null } : {}),
    })
    .eq("id", junta.id);

  if (error) return { error: "No se pudo cambiar el estado." };
  revalidarJunta(junta.id);
  return { ok: true };
}

const esquemaActa = z.object({
  texto: z.string().trim().max(50000).optional(),
  aprobada: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de aprobación no es válida.")
    .optional(),
});

/** Guarda el texto del acta y la fecha en que se aprobó. */
export async function guardarActa(
  _estado: EstadoJunta,
  datos: FormData,
): Promise<EstadoJunta> {
  const contexto = await juntaAdministrable(datos.get("junta_id"));
  if ("error" in contexto) return { error: contexto.error };
  const { supabase, junta } = contexto;

  const resultado = esquemaActa.safeParse({
    texto: datos.get("acta_texto") || undefined,
    aprobada: datos.get("acta_aprobada_en") || undefined,
  });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const { error } = await supabase
    .from("juntas")
    .update({
      acta_texto: resultado.data.texto ?? null,
      acta_aprobada_en: resultado.data.aprobada ?? null,
    })
    .eq("id", junta.id);

  if (error) return { error: "No se pudo guardar el acta." };
  revalidarJunta(junta.id);
  return { ok: true };
}

/**
 * Registra el PDF del acta que el navegador ya subió a
 * `<comunidad>/actas/<uuid>.pdf`. Crea la ficha en Documentos > Actas con el
 * cliente de servicio (el secretario no gestiona Documentos) y la enlaza a la
 * junta. Si había un acta anterior, se sustituye.
 */
export async function registrarActaPdf(datos: {
  juntaId: string;
  ruta: string;
}): Promise<EstadoJunta> {
  const contexto = await juntaAdministrable(datos.juntaId);
  if ("error" in contexto) return { error: contexto.error };
  const { supabase, junta, comunidad, usuario } = contexto;

  const prefijo = `${comunidad.id}/actas/`;
  const ruta = String(datos.ruta ?? "");
  const rutaValida =
    ruta.startsWith(prefijo) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i.test(
      ruta.slice(prefijo.length),
    );
  if (!rutaValida) return { error: "El archivo no es válido." };

  const admin = crearClienteAdmin();
  const { data: info, error: errorInfo } = await admin.storage.from("documentos").info(ruta);
  if (errorInfo || !info) return { error: "No se encontró el PDF subido. Inténtalo de nuevo." };

  if (info.contentType !== "application/pdf" || !info.size || info.size > TAMANO_MAXIMO_DOCUMENTO) {
    await admin.storage.from("documentos").remove([ruta]);
    return { error: "El PDF no es válido o supera el tamaño máximo." };
  }

  const { data: datosJunta } = await supabase
    .from("juntas")
    .select("titulo, fecha_hora")
    .eq("id", junta.id)
    .single();

  const { data: documento, error: errorFila } = await admin
    .from("documentos")
    .insert({
      comunidad_id: comunidad.id,
      nombre: `Acta · ${datosJunta?.titulo ?? "Junta"}`,
      descripcion: datosJunta?.fecha_hora
        ? `Junta del ${new Date(datosJunta.fecha_hora).toLocaleDateString("es-ES")}`
        : null,
      carpeta: "Actas",
      ruta_almacenamiento: ruta,
      tipo_mime: "application/pdf",
      tamano_bytes: info.size,
      subido_por: usuario.id,
    })
    .select("id")
    .single();

  if (errorFila || !documento) {
    await admin.storage.from("documentos").remove([ruta]);
    return { error: "No se pudo guardar el acta. Inténtalo de nuevo." };
  }

  const { error: errorJunta } = await supabase
    .from("juntas")
    .update({ acta_documento_id: documento.id })
    .eq("id", junta.id);

  if (errorJunta) {
    await admin.from("documentos").delete().eq("id", documento.id);
    await admin.storage.from("documentos").remove([ruta]);
    return { error: "No se pudo enlazar el acta a la junta." };
  }

  if (junta.acta_documento_id) {
    await quitarDocumentoActa(admin, junta.acta_documento_id, comunidad.id);
  }

  enviarAvisosDespues(comunidad.id);
  revalidarJunta(junta.id);
  revalidatePath("/documentos");
  return { ok: true };
}

/** Quita el PDF del acta de la junta (y de Documentos). */
export async function quitarActaPdf(
  _estado: EstadoJunta,
  datos: FormData,
): Promise<EstadoJunta> {
  const contexto = await juntaAdministrable(datos.get("id"));
  if ("error" in contexto) return { error: contexto.error };
  const { supabase, junta, comunidad } = contexto;

  if (!junta.acta_documento_id) return { ok: true };
  if (junta.estado === "cerrada") {
    return { error: "Reabre la junta antes de quitar el acta." };
  }

  const { error } = await supabase
    .from("juntas")
    .update({ acta_documento_id: null })
    .eq("id", junta.id);
  if (error) return { error: "No se pudo quitar el acta." };

  await quitarDocumentoActa(crearClienteAdmin(), junta.acta_documento_id, comunidad.id);
  revalidarJunta(junta.id);
  revalidatePath("/documentos");
  return { ok: true };
}

async function quitarDocumentoActa(
  admin: ReturnType<typeof crearClienteAdmin>,
  documentoId: string,
  comunidadId: string,
) {
  const { data: anterior } = await admin
    .from("documentos")
    .select("id, ruta_almacenamiento")
    .eq("id", documentoId)
    .eq("comunidad_id", comunidadId)
    .maybeSingle();
  if (!anterior) return;
  await admin.from("documentos").delete().eq("id", anterior.id);
  if (anterior.ruta_almacenamiento) {
    await admin.storage.from("documentos").remove([anterior.ruta_almacenamiento]);
  }
}
