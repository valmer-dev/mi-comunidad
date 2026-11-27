import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Gavel,
  ListOrdered,
  MapPin,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import {
  cambiarEstadoJunta,
  eliminarPunto,
  guardarActa,
  guardarAcuerdos,
  guardarPunto,
  moverPunto,
  quitarActaPdf,
} from "@/app/acciones/juntas";
import { requerirContexto } from "@/lib/auth";
import {
  antelacion,
  DIAS_MINIMOS_ORDINARIA,
  MEDIOS_CONVOCATORIA,
  type MedioConvocatoria,
} from "@/lib/convocatoria";
import { calcularQuorum, type ModoAsistencia } from "@/lib/juntas";
import { esCorreoInterno } from "@/lib/telefono";
import { esAdministrador } from "@/lib/permisos";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFecha, formatoFechaHora, formatoMoneda, formatoTamano } from "@/lib/utilidades";
import { EtiquetaEstado } from "@/components/ui/EtiquetaEstado";
import { BotonEnviar, FormularioJunta } from "./FormularioJunta";
import { EnviarConvocatoria } from "./EnviarConvocatoria";
import { ListaAsistencia, ResumenQuorum, type ViviendaAsistencia } from "./ListaAsistencia";
import { SubirActa } from "./SubirActa";

export const metadata = { title: "Junta" };

const TIPOS_PUNTO = {
  informativo: "Informativo",
  acuerdo: "Acuerdo",
  votacion: "Votación",
} as const;

const MAYORIAS = {
  simple: "Mayoría simple",
  doble: "Doble mayoría",
  unanimidad: "Unanimidad",
} as const;

function numero(valor: number | null) {
  return valor === null ? "" : valor.toLocaleString("es-ES", { maximumFractionDigits: 4 });
}

export default async function PaginaJunta(props: PageProps<"/juntas/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { comunidad, permisos } = await requerirContexto();
  const administrador = esAdministrador(permisos);
  const supabase = await crearClienteServidor();

  const { data: junta } = await supabase
    .from("juntas")
    .select(
      "id, titulo, tipo, fecha_hora, lugar, estado, segunda_convocatoria_minutos, acta_texto, acta_documento_id, acta_aprobada_en, celebrada_en, convocatoria_enviada_en, convocatoria_medios",
    )
    .eq("id", id)
    .eq("comunidad_id", comunidad.id)
    .maybeSingle();

  if (!junta) notFound();

  const [{ data: puntos }, { data: asistencias }, { data: fincas }, { data: documento }] =
    await Promise.all([
      supabase
        .from("puntos_del_dia")
        .select(
          "id, posicion, titulo, descripcion, tipo, mayoria_requerida, resultado, votos_favor, votos_contra, abstenciones",
        )
        .eq("junta_id", junta.id)
        .order("posicion")
        .order("creado_en"),
      supabase
        .from("asistencias")
        .select("finca_id, modo, representante_nombre, coeficiente")
        .eq("junta_id", junta.id),
      supabase
        .from("fincas")
        .select("id, codigo, coeficiente")
        .eq("comunidad_id", comunidad.id)
        .order("tipo")
        .order("numero"),
      junta.acta_documento_id
        ? supabase
            .from("documentos")
            .select("id, nombre, ruta_almacenamiento, tamano_bytes")
            .eq("id", junta.acta_documento_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  // Art. 15.2 y 16.2 LPH: viviendas con deudas vencidas el dia de la junta
  const { data: morosos } = await supabase.rpc("morosos_junta", { p_junta_id: junta.id });
  const deudaPorFinca = new Map((morosos ?? []).map((m) => [m.finca_id, m]));

  const idsFincas = (fincas ?? []).map((f) => f.id);
  const { data: titulares } = idsFincas.length
    ? await supabase
        .from("titulares")
        .select("finca_id, usuario_id, nombre")
        .in("finca_id", idsFincas)
        .is("hasta", null)
    : { data: [] };

  const idsPerfiles = [
    ...new Set((titulares ?? []).map((t) => t.usuario_id).filter((v): v is string => Boolean(v))),
  ];
  const { data: perfiles } = idsPerfiles.length
    ? await supabase.from("perfiles").select("id, nombre, apellidos").in("id", idsPerfiles)
    : { data: [] };
  const mapaPerfiles = new Map((perfiles ?? []).map((p) => [p.id, p]));

  const nombresPorFinca = new Map<string, string[]>();
  for (const titular of titulares ?? []) {
    const perfil = titular.usuario_id ? mapaPerfiles.get(titular.usuario_id) : null;
    const nombre =
      titular.nombre?.trim() ||
      [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(" ") ||
      "Titular";
    nombresPorFinca.set(titular.finca_id, [...(nombresPorFinca.get(titular.finca_id) ?? []), nombre]);
  }

  const asistenciaPorFinca = new Map((asistencias ?? []).map((a) => [a.finca_id, a]));
  const viviendas: ViviendaAsistencia[] = (fincas ?? []).map((finca) => {
    const asistencia = asistenciaPorFinca.get(finca.id);
    return {
      fincaId: finca.id,
      codigo: finca.codigo,
      titulares: (nombresPorFinca.get(finca.id) ?? []).join(", "),
      coeficiente: Number(asistencia?.coeficiente ?? finca.coeficiente),
      modo: (asistencia?.modo ?? "ausente") as ModoAsistencia,
      representante: asistencia?.representante_nombre ?? "",
      sinVoto: deudaPorFinca.has(finca.id),
    };
  });
  const coeficienteTotal = Number(comunidad.coeficiente_total) || 100;
  const quorum = calcularQuorum(
    viviendas,
    Object.fromEntries(viviendas.map((v) => [v.fincaId, v.modo])),
    coeficienteTotal,
  );

  let enlaceActa: string | null = null;
  if (documento?.ruta_almacenamiento) {
    const { data } = await crearClienteAdmin()
      .storage.from("documentos")
      .createSignedUrl(documento.ruta_almacenamiento, 60 * 60);
    enlaceActa = data?.signedUrl ?? null;
  }

  // Convocatoria: plazo y destinatarios del correo (solo correos reales)
  const plazo = antelacion({
    tipo: junta.tipo,
    fechaJunta: junta.fecha_hora,
    enviadaEn: junta.convocatoria_enviada_en,
  });
  let correos: string[] = [];
  if (administrador && junta.estado === "convocada") {
    const { data: miembros } = await supabase
      .from("miembros")
      .select("perfiles(correo)")
      .eq("comunidad_id", comunidad.id)
      .eq("estado", "activo");
    correos = [
      ...new Set(
        (miembros ?? [])
          .map((fila) => fila.perfiles?.correo?.trim().toLowerCase() ?? "")
          .filter((correo) => correo && !esCorreoInterno(correo)),
      ),
    ];
  }

  const listaPuntos = puntos ?? [];
  const cerrada = junta.estado === "cerrada";
  const editarOrden = administrador && !cerrada;
  const editarActa = administrador && junta.estado === "celebrada";
  const hayAsistencia = (asistencias ?? []).length > 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/juntas" className="inline-flex items-center gap-1.5 text-sm font-medium text-principal">
          <ArrowLeft className="size-4" aria-hidden />
          Juntas
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{junta.titulo}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-suave">
              <CalendarDays className="size-3.5" aria-hidden />
              {formatoFechaHora(junta.fecha_hora)}
              {junta.segunda_convocatoria_minutos > 0 &&
                ` · 2.ª convocatoria ${junta.segunda_convocatoria_minutos} min después`}
            </p>
            {junta.lugar && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-suave">
                <MapPin className="size-3.5" aria-hidden />
                {junta.lugar}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-neutro-claro capitalize text-neutro">{junta.tipo}</span>
            <EtiquetaEstado estado={junta.estado} />
          </div>
        </div>

        {administrador && (
          <div className="mt-4 flex flex-wrap gap-2">
            {junta.estado === "convocada" && (
              <FormularioJunta accion={cambiarEstadoJunta} juntaId={junta.id} ocultos={{ estado: "celebrada" }}>
                <BotonEnviar className="boton boton-principal">
                  <CheckCircle2 className="size-4" aria-hidden />
                  Marcar como celebrada
                </BotonEnviar>
              </FormularioJunta>
            )}
            {junta.estado === "celebrada" && (
              <>
                <FormularioJunta accion={cambiarEstadoJunta} juntaId={junta.id} ocultos={{ estado: "cerrada" }}>
                  <BotonEnviar className="boton boton-principal">
                    <CheckCircle2 className="size-4" aria-hidden />
                    Cerrar junta con el acta
                  </BotonEnviar>
                </FormularioJunta>
                <FormularioJunta accion={cambiarEstadoJunta} juntaId={junta.id} ocultos={{ estado: "convocada" }}>
                  <BotonEnviar className="boton boton-borde">
                    <RotateCcw className="size-4" aria-hidden />
                    Volver a convocada
                  </BotonEnviar>
                </FormularioJunta>
              </>
            )}
            {cerrada && (
              <FormularioJunta
                accion={cambiarEstadoJunta}
                juntaId={junta.id}
                ocultos={{ estado: "celebrada" }}
                confirmar="¿Reabrir la junta para corregir el acta?"
              >
                <BotonEnviar className="boton boton-borde">
                  <RotateCcw className="size-4" aria-hidden />
                  Reabrir
                </BotonEnviar>
              </FormularioJunta>
            )}
          </div>
        )}
      </div>

      {/* Convocatoria */}
      <section className="tarjeta">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Send className="size-4.5 text-principal" aria-hidden />
            Convocatoria
          </h2>
          <Link href={`/juntas/${junta.id}/convocatoria`} className="boton boton-borde px-3 py-1.5 text-sm">
            <FileText className="size-4" aria-hidden />
            Ver convocatoria y PDF
          </Link>
        </div>

        {junta.convocatoria_enviada_en ? (
          <p className="mt-2 text-sm">
            Enviada el {formatoFecha(junta.convocatoria_enviada_en)}
            {junta.convocatoria_medios.length > 0 &&
              ` (${junta.convocatoria_medios
                .map((medio) => MEDIOS_CONVOCATORIA[medio as MedioConvocatoria]?.toLowerCase() ?? medio)
                .join(", ")})`}
            , {plazo.dias === 1 ? "1 día" : `${plazo.dias} días`} antes de la junta.
          </p>
        ) : (
          <p className="mt-2 text-sm text-suave">Todavía no se ha enviado.</p>
        )}

        {junta.estado === "convocada" && !plazo.cumple && (
          <p className="aviso aviso-atencion mt-3">
            {plazo.ordinaria
              ? `La junta ordinaria debe convocarse con al menos ${DIAS_MINIMOS_ORDINARIA} días de antelación (art. 16.3 LPH). ${
                  plazo.enviada ? "Se envió" : "Si la envías hoy, llegaría"
                } con ${plazo.dias === 1 ? "1 día" : `${plazo.dias} días`}: conviene cambiar la fecha para evitar que se impugnen los acuerdos.`
              : "La junta es hoy o ya ha pasado: la convocatoria no llegaría con antelación suficiente."}
          </p>
        )}
        {junta.estado === "convocada" && plazo.cumple && !plazo.enviada && plazo.ordinaria && (
          <p className="mt-2 text-xs text-suave">
            Si la envías hoy, llega con {plazo.dias} días de antelación (mínimo {DIAS_MINIMOS_ORDINARIA}).
          </p>
        )}

        {administrador && junta.estado === "convocada" && (
          <div className="mt-4">
            <EnviarConvocatoria
              juntaId={junta.id}
              medios={junta.convocatoria_medios}
              correos={correos}
              asunto={`Convocatoria: ${junta.titulo}`}
              cuerpo={`Hola:\n\nOs convocamos a la junta ${junta.tipo} de la comunidad el ${formatoFechaHora(junta.fecha_hora)}${junta.lugar ? ` en ${junta.lugar}` : ""}.\n\nLa convocatoria completa, con el orden del día y el modelo de representación, está en la app:\n${(process.env.NEXT_PUBLIC_URL_APP ?? "").replace(/\/$/, "")}/juntas/${junta.id}/convocatoria\n\nUn saludo.`}
            />
          </div>
        )}
      </section>

      {/* Orden del día */}
      <section className="tarjeta">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ListOrdered className="size-4.5 text-principal" aria-hidden />
          Orden del día
        </h2>
        {listaPuntos.length === 0 ? (
          <p className="mt-2 text-sm text-suave">Todavía no hay puntos en el orden del día.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {listaPuntos.map((punto, indice) => (
              <li key={punto.id} className="rounded-xl border border-borde p-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-principal/10 text-sm font-semibold text-principal">
                    {indice + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{punto.titulo}</p>
                    <p className="text-xs text-suave">
                      {TIPOS_PUNTO[punto.tipo]}
                      {punto.tipo !== "informativo" && ` · ${MAYORIAS[punto.mayoria_requerida]}`}
                    </p>
                    {punto.descripcion && (
                      <p className="mt-1 whitespace-pre-line text-sm text-tinta/90">{punto.descripcion}</p>
                    )}
                  </div>
                  {editarOrden && (
                    <div className="flex shrink-0 items-center">
                      <FormularioJunta accion={moverPunto} juntaId={junta.id} ocultos={{ id: punto.id }}>
                        <BotonEnviar
                          className="grid size-9 place-items-center rounded-full text-suave hover:bg-hundido disabled:opacity-40"
                          etiqueta="Subir punto"
                          nombre="direccion"
                          valor="arriba"
                        >
                          <ArrowUp className="size-4" aria-hidden />
                        </BotonEnviar>
                        <BotonEnviar
                          className="grid size-9 place-items-center rounded-full text-suave hover:bg-hundido"
                          etiqueta="Bajar punto"
                          nombre="direccion"
                          valor="abajo"
                        >
                          <ArrowDown className="size-4" aria-hidden />
                        </BotonEnviar>
                      </FormularioJunta>
                      <FormularioJunta
                        accion={eliminarPunto}
                        juntaId={junta.id}
                        ocultos={{ id: punto.id }}
                        confirmar={`¿Quitar el punto «${punto.titulo}»?`}
                      >
                        <BotonEnviar
                          className="grid size-9 place-items-center rounded-full text-suave hover:bg-peligro-claro hover:text-peligro"
                          etiqueta="Quitar punto"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </BotonEnviar>
                      </FormularioJunta>
                    </div>
                  )}
                </div>
                {editarOrden && (
                  <details className="mt-2 pl-10">
                    <summary className="cursor-pointer text-sm font-medium text-principal">Editar</summary>
                    <FormularioPunto juntaId={junta.id} punto={punto} />
                  </details>
                )}
              </li>
            ))}
          </ol>
        )}
        {editarOrden && (
          <details className="mt-4">
            <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-principal">
              <Plus className="size-4" aria-hidden />
              Añadir punto
            </summary>
            <FormularioPunto juntaId={junta.id} />
          </details>
        )}
      </section>

      {/* Propietarios que no estan al corriente */}
      <section className="tarjeta">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <AlertTriangle className="size-4.5 text-principal" aria-hidden />
          Propietarios que no están al corriente
        </h2>
        <p className="mt-1 text-sm text-suave">
          Viviendas con recibos vencidos y sin pagar el día de la junta. Pueden asistir y
          hablar, pero no votar (art. 15.2 LPH). Esta relación debe figurar en la
          convocatoria (art. 16.2).
        </p>
        {(morosos ?? []).length === 0 ? (
          <p className="mt-3 rounded-xl bg-exito-claro px-3.5 py-2.5 text-sm text-exito">
            Todas las viviendas están al corriente de pago.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-borde text-sm">
            {(morosos ?? []).map((moroso) => (
              <li key={moroso.finca_id} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 py-2">
                <span>
                  <span className="font-medium">{moroso.codigo}</span>
                  {nombresPorFinca.get(moroso.finca_id)?.length ? (
                    <span className="text-suave"> · {nombresPorFinca.get(moroso.finca_id)?.join(", ")}</span>
                  ) : null}
                </span>
                {administrador && (
                  <span className="tabular-nums text-peligro">
                    {formatoMoneda(moroso.deuda)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Asistencia */}
      <section className="tarjeta">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Users className="size-4.5 text-principal" aria-hidden />
          Asistencia
        </h2>
        <div className="mt-3">
          {viviendas.length === 0 ? (
            <p className="text-sm text-suave">La comunidad aún no tiene viviendas dadas de alta.</p>
          ) : administrador && !cerrada ? (
            <ListaAsistencia juntaId={junta.id} viviendas={viviendas} coeficienteTotal={coeficienteTotal} />
          ) : hayAsistencia ? (
            <>
              <ResumenQuorum {...quorum} />
              <ul className="mt-3 divide-y divide-borde text-sm">
                {viviendas
                  .filter((v) => v.modo !== "ausente")
                  .map((v) => (
                    <li key={v.fincaId} className="flex justify-between gap-3 py-2">
                      <span className="font-medium">{v.codigo}</span>
                      <span className="text-suave">
                        {v.modo === "presencial"
                          ? "Presente"
                          : `Representada${v.representante ? ` por ${v.representante}` : ""}`}
                      </span>
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-suave">La asistencia se registra el día de la junta.</p>
          )}
        </div>
      </section>

      {/* Acuerdos */}
      {junta.estado !== "convocada" && listaPuntos.length > 0 && (
        <section className="tarjeta">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Gavel className="size-4.5 text-principal" aria-hidden />
            Acuerdos
          </h2>
          {editarActa ? (
            <FormularioJunta
              accion={guardarAcuerdos}
              juntaId={junta.id}
              className="mt-3"
              boton={
                <>
                  <Save className="size-4" aria-hidden />
                  Guardar acuerdos
                </>
              }
            >
              <p className="text-sm text-suave">
                Los votos se anotan como suma de coeficientes (%) de las viviendas.
                {quorum.sinVoto > 0 &&
                  ` No cuentes ${quorum.sinVoto === 1 ? "la vivienda" : `las ${quorum.sinVoto} viviendas`} con deudas vencidas: pueden votar como máximo el ${quorum.porcentajeVoto.toLocaleString("es-ES", { maximumFractionDigits: 2 })} %.`}
              </p>
              <ol className="mt-3 space-y-4">
                {listaPuntos.map((punto, indice) => (
                  <li key={punto.id} className="grid gap-2">
                    <p className="font-medium">
                      {indice + 1}. {punto.titulo}
                    </p>
                    <textarea
                      name={`resultado_${punto.id}`}
                      defaultValue={punto.resultado ?? ""}
                      rows={2}
                      aria-label={`Acuerdo del punto ${indice + 1}`}
                      placeholder={punto.tipo === "informativo" ? "Resumen de lo informado" : "Texto del acuerdo"}
                      className="campo resize-y"
                    />
                    {punto.tipo !== "informativo" && (
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            ["favor", "A favor", punto.votos_favor],
                            ["contra", "En contra", punto.votos_contra],
                            ["abstenciones", "Abstenciones", punto.abstenciones],
                          ] as const
                        ).map(([clave, texto, valor]) => (
                          <label key={clave} className="text-xs text-suave">
                            {texto} (%)
                            <input
                              name={`${clave}_${punto.id}`}
                              inputMode="decimal"
                              defaultValue={numero(valor)}
                              className="campo mt-1"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </FormularioJunta>
          ) : (
            <ol className="mt-3 space-y-3 text-sm">
              {listaPuntos.map((punto, indice) => (
                <li key={punto.id}>
                  <p className="font-medium">
                    {indice + 1}. {punto.titulo}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-tinta/90">
                    {punto.resultado || <span className="text-suave">Sin acuerdo anotado.</span>}
                  </p>
                  {punto.tipo !== "informativo" &&
                    [punto.votos_favor, punto.votos_contra, punto.abstenciones].some((v) => v !== null) && (
                      <p className="mt-0.5 text-xs text-suave">
                        A favor {numero(punto.votos_favor) || "0"} % · En contra{" "}
                        {numero(punto.votos_contra) || "0"} % · Abstenciones{" "}
                        {numero(punto.abstenciones) || "0"} %
                      </p>
                    )}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {/* Acta */}
      {junta.estado !== "convocada" && (
        <section className="tarjeta">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ClipboardList className="size-4.5 text-principal" aria-hidden />
            Acta
          </h2>

          {documento && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borde p-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText className="size-5 shrink-0 text-principal" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate font-medium">{documento.nombre}</p>
                  <p className="text-xs text-suave">
                    PDF · {formatoTamano(documento.tamano_bytes)}
                    {junta.acta_aprobada_en && ` · aprobada el ${formatoFecha(junta.acta_aprobada_en)}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {enlaceActa && (
                  <a href={enlaceActa} target="_blank" rel="noreferrer" className="boton boton-suave">
                    <Download className="size-4" aria-hidden />
                    Abrir
                  </a>
                )}
                {editarActa && (
                  <FormularioJunta
                    accion={quitarActaPdf}
                    juntaId={junta.id}
                    ocultos={{ id: junta.id }}
                    confirmar="¿Quitar el PDF del acta? También se borrará de Documentos."
                  >
                    <BotonEnviar className="boton boton-borde" etiqueta="Quitar PDF">
                      <Trash2 className="size-4" aria-hidden />
                    </BotonEnviar>
                  </FormularioJunta>
                )}
              </div>
            </div>
          )}

          {editarActa ? (
            <div className="mt-4 grid gap-5">
              <SubirActa juntaId={junta.id} comunidadId={comunidad.id} reemplazar={Boolean(documento)} />
              <FormularioJunta
                accion={guardarActa}
                juntaId={junta.id}
                boton={
                  <>
                    <Save className="size-4" aria-hidden />
                    Guardar acta
                  </>
                }
              >
                <div className="grid gap-4">
                  <div>
                    <label htmlFor="acta_texto" className="etiqueta">
                      Texto o resumen del acta (opcional)
                    </label>
                    <textarea
                      id="acta_texto"
                      name="acta_texto"
                      rows={6}
                      defaultValue={junta.acta_texto ?? ""}
                      className="campo resize-y"
                      placeholder="Borrador del acta o resumen para los vecinos"
                    />
                  </div>
                  <div className="sm:max-w-xs">
                    <label htmlFor="acta_aprobada_en" className="etiqueta">
                      Fecha de aprobación (opcional)
                    </label>
                    <input
                      id="acta_aprobada_en"
                      name="acta_aprobada_en"
                      type="date"
                      defaultValue={junta.acta_aprobada_en ?? ""}
                      className="campo"
                    />
                  </div>
                </div>
              </FormularioJunta>
            </div>
          ) : (
            <>
              {junta.acta_texto && (
                <p className="mt-3 whitespace-pre-line text-sm text-tinta/90">{junta.acta_texto}</p>
              )}
              {!documento && !junta.acta_texto && (
                <p className="mt-2 text-sm text-suave">El acta aún no está disponible.</p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

function FormularioPunto({
  juntaId,
  punto,
}: {
  juntaId: string;
  punto?: {
    id: string;
    titulo: string;
    descripcion: string | null;
    tipo: keyof typeof TIPOS_PUNTO;
    mayoria_requerida: keyof typeof MAYORIAS;
  };
}) {
  const sufijo = punto?.id ?? "nuevo";
  return (
    <FormularioJunta
      accion={guardarPunto}
      juntaId={juntaId}
      ocultos={punto ? { punto_id: punto.id } : undefined}
      reiniciar={!punto}
      className="mt-3 grid gap-3 sm:grid-cols-2"
      boton={
        <>
          {punto ? <Save className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          {punto ? "Guardar punto" : "Añadir"}
        </>
      }
    >
      <div className="sm:col-span-2">
        <label htmlFor={`titulo_${sufijo}`} className="etiqueta">
          Título
        </label>
        <input
          id={`titulo_${sufijo}`}
          name="titulo"
          required
          defaultValue={punto?.titulo}
          className="campo"
          placeholder="Presupuesto 2027"
        />
      </div>
      <div>
        <label htmlFor={`tipo_${sufijo}`} className="etiqueta">
          Tipo
        </label>
        <select id={`tipo_${sufijo}`} name="tipo" defaultValue={punto?.tipo ?? "acuerdo"} className="campo">
          {Object.entries(TIPOS_PUNTO).map(([valor, texto]) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`mayoria_${sufijo}`} className="etiqueta">
          Mayoría necesaria
        </label>
        <select
          id={`mayoria_${sufijo}`}
          name="mayoria"
          defaultValue={punto?.mayoria_requerida ?? "simple"}
          className="campo"
        >
          {Object.entries(MAYORIAS).map(([valor, texto]) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`descripcion_${sufijo}`} className="etiqueta">
          Descripción (opcional)
        </label>
        <textarea
          id={`descripcion_${sufijo}`}
          name="descripcion"
          rows={2}
          defaultValue={punto?.descripcion ?? ""}
          className="campo resize-y"
        />
      </div>
    </FormularioJunta>
  );
}
