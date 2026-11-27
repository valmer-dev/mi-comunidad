import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Megaphone,
  PiggyBank,
  Pin,
  Plus,
  ReceiptText,
  Wallet,
  Wrench,
} from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { textoPlanoAnuncio } from "@/lib/anuncios";
import { cargarCalendario, ETIQUETAS_EVENTO, type Evento } from "@/lib/calendario";
import { cargarTesoreria } from "@/lib/datos-tesoreria";
import {
  esAdministrador,
  puedeEditarFinanzas,
  puedeGestionarIncidencias,
  puedeVerFinanzas,
} from "@/lib/permisos";
import { diasEntre } from "@/lib/proveedores";
import { hoyISO, resumirRecibos, type ResumenCuenta } from "@/lib/recibos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { cn, formatoFecha, formatoFechaHora, formatoMoneda } from "@/lib/utilidades";
import { EtiquetaEstado } from "@/components/ui/EtiquetaEstado";
import { COLUMNAS_RECIBO, normalizarRecibos } from "../finanzas/recibos/datos";

export const metadata = { title: "Panel" };

/** Lo que entra en "Requiere atención": lo vencido y lo de los próximos 30 días. */
const DIAS_ATENCION = 30;
const MAX_ATENCION = 6;

type Supabase = Awaited<ReturnType<typeof crearClienteServidor>>;

/**
 * Panel de inicio. Muestra lo más importante para cada persona:
 * - Vecino: su cuenta (recibos), la próxima junta, sus incidencias y el tablón.
 * - Junta y administrador de fincas: cifras de tesorería y cobros, lo que
 *   vence en el calendario, la próxima junta y el tablón.
 */
export default async function PaginaPanel() {
  const { usuario, perfil, comunidad, permisos } = await requerirContexto();
  const supabase = await crearClienteServidor();
  const hoy = hoyISO();

  const gestor = esAdministrador(permisos) || puedeEditarFinanzas(permisos);
  const verFinanzas = puedeVerFinanzas(permisos);
  const verTodasIncidencias = gestor || puedeGestionarIncidencias(permisos);

  const [misFincas, proximaJunta, { data: anuncios }, incidencias] = await Promise.all([
    cargarMisFincas(supabase, usuario.id, hoy),
    cargarProximaJunta(supabase, comunidad.id, gestor),
    supabase
      .from("anuncios")
      .select("id, titulo, contenido, publicado_en, fijado")
      .eq("comunidad_id", comunidad.id)
      .order("fijado", { ascending: false })
      .order("publicado_en", { ascending: false })
      .limit(3),
    cargarIncidencias(supabase, comunidad.id, verTodasIncidencias ? null : usuario.id),
  ]);

  const idsMisFincas = misFincas.map((finca) => finca.id);

  const [miCuenta, sinVoto, gestion] = await Promise.all([
    cargarMiCuenta(supabase, idsMisFincas, hoy),
    viviendasSinVoto(supabase, proximaJunta, idsMisFincas),
    gestor ? cargarGestion(supabase, comunidad, hoy, verFinanzas) : Promise.resolve(null),
  ]);

  const fechaHoy = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Madrid",
  }).format(new Date());

  const tarjetaJunta = (
    <TarjetaJunta junta={proximaJunta} gestor={gestor} sinVoto={sinVoto} />
  );
  const tarjetaCuenta =
    misFincas.length > 0 ? (
      <TarjetaMiCuenta resumen={miCuenta} viviendas={misFincas.map((f) => f.codigo)} />
    ) : null;
  const tarjetaIncidencias = (
    <TarjetaIncidencias
      incidencias={incidencias.lista}
      total={incidencias.total}
      deLaComunidad={verTodasIncidencias}
    />
  );
  const tarjetaAnuncios = <TarjetaAnuncios anuncios={anuncios ?? []} />;

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-marca to-marca-oscuro px-5 py-6 text-white shadow-elevada sm:px-7 sm:py-8">
        <div
          className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-white/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 right-24 size-48 rounded-full bg-white/5"
          aria-hidden
        />
        <div className="relative">
          <p className="text-sm font-medium text-white/75 first-letter:uppercase">{fechaHoy}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Hola, {perfil?.nombre?.trim() || "vecino"}
          </h1>
          <p className="mt-1 text-[15px] text-white/80">
            {comunidad.nombre}
            {comunidad.direccion ? ` · ${comunidad.direccion}` : ""}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/incidencias"
              className="boton bg-white text-marca-oscuro shadow-suave hover:bg-white/90"
            >
              <Plus className="size-4" aria-hidden />
              Reportar incidencia
            </Link>
            <Link
              href="/tablon"
              className="boton bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25"
            >
              <Megaphone className="size-4" aria-hidden />
              Ver tablón
            </Link>
          </div>
        </div>
      </section>

      {gestion ? (
        <>
          <section aria-label="Resumen de la comunidad" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {gestion.tesoreria && (
              <Indicador
                etiqueta="Saldo en cuenta"
                valor={formatoMoneda(gestion.tesoreria.saldo)}
                detalle="Según los movimientos registrados"
                icono={Wallet}
                href="/finanzas"
                tono="bg-exito-claro text-exito"
              />
            )}
            <Indicador
              etiqueta="Pendiente de cobro"
              valor={formatoMoneda(gestion.cobros.pendiente)}
              detalle={
                gestion.viviendasMorosas > 0
                  ? `${formatoMoneda(gestion.cobros.vencido)} vencidos · ${gestion.viviendasMorosas} ${
                      gestion.viviendasMorosas === 1 ? "vivienda" : "viviendas"
                    }`
                  : "Ninguna vivienda con recibos vencidos"
              }
              alerta={gestion.viviendasMorosas > 0}
              icono={ReceiptText}
              href="/finanzas/recibos"
              tono="bg-atencion-claro text-atencion"
            />
            <Indicador
              etiqueta="Incidencias abiertas"
              valor={String(incidencias.total)}
              detalle={
                incidencias.urgentes > 0
                  ? `${incidencias.urgentes} ${incidencias.urgentes === 1 ? "urgente" : "urgentes"}`
                  : "Ninguna urgente"
              }
              alerta={incidencias.urgentes > 0}
              icono={Wrench}
              href="/incidencias"
              tono="bg-info-claro text-info"
            />
            {gestion.tesoreria && (
              <Indicador
                etiqueta="Fondo de reserva"
                valor={formatoMoneda(gestion.tesoreria.fondo)}
                detalle={
                  gestion.tesoreria.presupuestoOrdinario > 0
                    ? `${gestion.tesoreria.fondoBajo ? "Por debajo del mínimo" : "Mínimo legal"} ${formatoMoneda(
                        gestion.tesoreria.minimo,
                      )}`
                    : "Pon la cuota para calcular el mínimo"
                }
                alerta={gestion.tesoreria.fondoBajo}
                icono={PiggyBank}
                href="/finanzas"
                tono="bg-principal/10 text-principal"
              />
            )}
          </section>

          <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
            <div className="space-y-5 lg:col-span-2">
              <TarjetaAtencion eventos={gestion.atencion} total={gestion.totalAtencion} hoy={hoy} />
              <div className="hidden lg:block">{tarjetaAnuncios}</div>
            </div>
            <aside className="space-y-5">
              {tarjetaJunta}
              {tarjetaCuenta}
              <div className="lg:hidden">{tarjetaAnuncios}</div>
            </aside>
          </div>
        </>
      ) : (
        <>
          <div className={cn("grid gap-5", tarjetaCuenta && "md:grid-cols-2")}>
            {tarjetaCuenta}
            {tarjetaJunta}
          </div>
          <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
            <div className="lg:order-2">{tarjetaIncidencias}</div>
            <div className="lg:order-1 lg:col-span-2">{tarjetaAnuncios}</div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

/** Viviendas de las que la persona es titular hoy. */
async function cargarMisFincas(supabase: Supabase, usuarioId: string, hoy: string) {
  const { data } = await supabase
    .from("titulares")
    .select("finca_id, fincas(codigo)")
    .eq("usuario_id", usuarioId)
    .or(`hasta.is.null,hasta.gte.${hoy}`);

  const vistas = new Map<string, string>();
  for (const fila of data ?? []) {
    vistas.set(fila.finca_id, fila.fincas?.codigo ?? "Vivienda");
  }
  return [...vistas].map(([id, codigo]) => ({ id, codigo }));
}

async function cargarMiCuenta(supabase: Supabase, fincas: string[], hoy: string) {
  if (fincas.length === 0) return null;
  const { data } = await supabase.from("recibos").select(COLUMNAS_RECIBO).in("finca_id", fincas);
  return resumirRecibos(normalizarRecibos(data), hoy);
}

/**
 * Próxima junta. Un vecino solo ve las convocadas; la junta ve también las que
 * están en borrador, para acordarse de convocarlas.
 */
async function cargarProximaJunta(supabase: Supabase, comunidadId: string, gestor: boolean) {
  const { data: junta } = await supabase
    .from("juntas")
    .select("id, titulo, tipo, fecha_hora, lugar, estado, convocatoria_enviada_en")
    .eq("comunidad_id", comunidadId)
    .gte("fecha_hora", new Date().toISOString())
    .in("estado", gestor ? ["borrador", "convocada"] : ["convocada"])
    .order("fecha_hora", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!junta) return null;

  const { data: puntos } = await supabase
    .from("puntos_del_dia")
    .select("id, titulo")
    .eq("junta_id", junta.id)
    .order("posicion")
    .order("creado_en");

  return { ...junta, puntos: puntos ?? [] };
}

type ProximaJunta = Awaited<ReturnType<typeof cargarProximaJunta>>;

/** Viviendas de la persona con deudas vencidas a la fecha de la junta (art. 15.2 LPH). */
async function viviendasSinVoto(supabase: Supabase, junta: ProximaJunta, fincas: string[]) {
  if (!junta || junta.estado === "borrador" || fincas.length === 0) return [];
  const { data } = await supabase.rpc("morosos_junta", { p_junta_id: junta.id });
  const mias = new Set(fincas);
  return (data ?? []).filter((moroso) => mias.has(moroso.finca_id)).map((moroso) => moroso.codigo);
}

/** Incidencias abiertas: todas las de la comunidad, o solo las que reportó la persona. */
async function cargarIncidencias(supabase: Supabase, comunidadId: string, reportadoPor: string | null) {
  let consulta = supabase
    .from("incidencias")
    .select("id, titulo, estado, prioridad, creado_en", { count: "exact" })
    .eq("comunidad_id", comunidadId)
    .in("estado", ["abierta", "en_curso"]);
  if (reportadoPor) consulta = consulta.eq("reportado_por", reportadoPor);

  const [{ data, count }, { count: urgentes }] = await Promise.all([
    consulta.order("creado_en", { ascending: false }).limit(4),
    reportadoPor
      ? Promise.resolve({ count: 0 })
      : supabase
          .from("incidencias")
          .select("*", { count: "exact", head: true })
          .eq("comunidad_id", comunidadId)
          .in("estado", ["abierta", "en_curso"])
          .eq("prioridad", "urgente"),
  ]);

  return { lista: data ?? [], total: count ?? 0, urgentes: urgentes ?? 0 };
}

/** Cifras y vencimientos que necesita la junta o el administrador de fincas. */
async function cargarGestion(
  supabase: Supabase,
  comunidad: Parameters<typeof cargarTesoreria>[1],
  hoy: string,
  verFinanzas: boolean,
) {
  const [tesoreria, { data: filasRecibos }, eventos] = await Promise.all([
    verFinanzas ? cargarTesoreria(supabase, comunidad) : Promise.resolve(null),
    supabase.from("recibos").select(COLUMNAS_RECIBO).eq("comunidad_id", comunidad.id),
    cargarCalendario(supabase, comunidad.id, hoy),
  ]);

  const recibos = normalizarRecibos(filasRecibos);
  const cobros = resumirRecibos(recibos, hoy);

  const porFinca = new Map<string, typeof recibos>();
  for (const recibo of recibos) {
    const lista = porFinca.get(recibo.finca_id) ?? [];
    lista.push(recibo);
    porFinca.set(recibo.finca_id, lista);
  }
  const viviendasMorosas = [...porFinca.values()].filter(
    (lista) => resumirRecibos(lista, hoy).vencido > 0,
  ).length;

  const pendientes = eventos.filter((evento) => diasEntre(hoy, evento.fecha) <= DIAS_ATENCION);

  return {
    tesoreria,
    cobros,
    viviendasMorosas,
    atencion: pendientes.slice(0, MAX_ATENCION),
    totalAtencion: pendientes.length,
  };
}

// ---------------------------------------------------------------------------
// Tarjetas
// ---------------------------------------------------------------------------

function Indicador({
  etiqueta,
  valor,
  detalle,
  icono: Icono,
  href,
  tono,
  alerta = false,
}: {
  etiqueta: string;
  valor: string;
  detalle: string;
  icono: typeof Wallet;
  href: string;
  tono: string;
  alerta?: boolean;
}) {
  return (
    <Link href={href} className="tarjeta tarjeta-enlace group flex flex-col p-4">
      <div className="flex items-center justify-between">
        <span className={cn("icono-seccion size-10", alerta ? "bg-peligro-claro text-peligro" : tono)}>
          <Icono className="size-5" aria-hidden />
        </span>
        <ArrowRight
          className="size-4 text-suave/60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-principal"
          aria-hidden
        />
      </div>
      <p className="mt-4 truncate font-titulo text-xl font-semibold leading-tight tabular-nums sm:text-2xl">
        {valor}
      </p>
      <p className="mt-1 text-sm font-medium leading-snug">{etiqueta}</p>
      <p className={cn("mt-0.5 text-xs leading-snug", alerta ? "font-semibold text-peligro" : "text-suave")}>
        {detalle}
      </p>
    </Link>
  );
}

function CabeceraTarjeta({
  titulo,
  icono: Icono,
  tono,
  enlace,
}: {
  titulo: string;
  icono: typeof Wallet;
  tono: string;
  enlace?: { href: string; texto: string };
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2.5 text-lg font-semibold">
        <span className={cn("icono-seccion size-8 rounded-lg", tono)}>
          <Icono className="size-4" aria-hidden />
        </span>
        {titulo}
      </h2>
      {enlace && (
        <Link
          href={enlace.href}
          className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-principal hover:bg-principal/10"
        >
          {enlace.texto} <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function TarjetaMiCuenta({
  resumen,
  viviendas,
}: {
  resumen: ResumenCuenta | null;
  viviendas: string[];
}) {
  const pendiente = resumen?.pendiente ?? 0;
  const vencido = resumen?.vencido ?? 0;

  return (
    <section className="tarjeta">
      <CabeceraTarjeta
        titulo="Mi cuenta"
        icono={ReceiptText}
        tono="bg-atencion-claro text-atencion"
        enlace={{ href: "/finanzas/recibos", texto: "Mis recibos" }}
      />
      <p className="mt-1 text-sm text-suave">{viviendas.join(", ")}</p>

      {pendiente > 0 ? (
        <div className="mt-4">
          <p
            className={cn(
              "font-titulo text-2xl font-semibold tabular-nums",
              vencido > 0 ? "text-peligro" : "text-tinta",
            )}
          >
            {formatoMoneda(pendiente)}
          </p>
          <p className="mt-0.5 text-[15px] text-suave">
            pendientes en {resumen?.recibosPendientes}{" "}
            {resumen?.recibosPendientes === 1 ? "recibo" : "recibos"}
          </p>
          {vencido > 0 && (
            <p className="aviso aviso-atencion mt-3 text-sm">
              Tienes {formatoMoneda(vencido)} vencidos. Ponte al día para poder votar en las juntas.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-[15px] font-semibold text-exito">
          <CheckCircle2 className="size-5" aria-hidden />
          Estás al corriente de pago
        </p>
      )}
    </section>
  );
}

function TarjetaJunta({
  junta,
  gestor,
  sinVoto,
}: {
  junta: ProximaJunta;
  gestor: boolean;
  sinVoto: string[];
}) {
  if (!junta) {
    return (
      <section className="tarjeta">
        <CabeceraTarjeta
          titulo="Próxima junta"
          icono={CalendarDays}
          tono="bg-principal/10 text-principal"
          enlace={{ href: "/juntas", texto: "Juntas" }}
        />
        <p className="mt-3 text-[15px] text-suave">No hay ninguna junta convocada.</p>
      </section>
    );
  }

  const borrador = junta.estado === "borrador";
  const puntos = junta.puntos;

  return (
    <section className="tarjeta">
      <CabeceraTarjeta titulo="Próxima junta" icono={CalendarDays} tono="bg-principal/10 text-principal" />
      <div className="mt-4 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold leading-snug">{junta.titulo}</p>
          <EtiquetaEstado estado={junta.estado} className="shrink-0" />
        </div>
        <p className="text-[15px] text-suave">{formatoFechaHora(junta.fecha_hora)}</p>
        {junta.lugar && <p className="text-[15px] text-suave">{junta.lugar}</p>}
      </div>

      {puntos.length > 0 && (
        <div className="mt-4">
          <p className="sobretitulo">Orden del día</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[15px]">
            {puntos.slice(0, 4).map((punto) => (
              <li key={punto.id} className="leading-snug">
                {punto.titulo}
              </li>
            ))}
          </ol>
          {puntos.length > 4 && (
            <p className="mt-1 text-sm text-suave">y {puntos.length - 4} puntos más</p>
          )}
        </div>
      )}

      {gestor && (
        <p
          className={cn(
            "mt-4 flex items-center gap-2 text-sm",
            junta.convocatoria_enviada_en ? "text-suave" : "font-semibold text-atencion",
          )}
        >
          {junta.convocatoria_enviada_en ? (
            <>
              <CheckCircle2 className="size-4 text-exito" aria-hidden />
              Convocatoria enviada el {formatoFecha(junta.convocatoria_enviada_en)}
            </>
          ) : (
            <>
              <Clock className="size-4" aria-hidden />
              {borrador ? "En borrador: falta convocarla" : "Falta enviar la convocatoria"}
            </>
          )}
        </p>
      )}

      {sinVoto.length > 0 && (
        <p className="aviso aviso-atencion mt-4 text-sm">
          {sinVoto.join(", ")} {sinVoto.length === 1 ? "tiene" : "tienen"} recibos vencidos: podrás
          asistir, pero no votar, si no te pones al día antes de la junta (art. 15.2 LPH).
        </p>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link href={`/juntas/${junta.id}`} className="boton boton-suave">
          Ver detalle <ArrowRight className="size-4" aria-hidden />
        </Link>
        {!borrador && (
          <Link href={`/juntas/${junta.id}/convocatoria`} className="boton boton-borde">
            Convocatoria
          </Link>
        )}
      </div>
    </section>
  );
}

function TarjetaIncidencias({
  incidencias,
  total,
  deLaComunidad,
}: {
  incidencias: { id: string; titulo: string; estado: string; prioridad: string; creado_en: string }[];
  total: number;
  deLaComunidad: boolean;
}) {
  return (
    <section className="tarjeta">
      <CabeceraTarjeta
        titulo={deLaComunidad ? "Incidencias abiertas" : "Mis incidencias"}
        icono={Wrench}
        tono="bg-info-claro text-info"
        enlace={{ href: "/incidencias", texto: "Ver todo" }}
      />
      {incidencias.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {incidencias.map((incidencia) => (
            <li key={incidencia.id}>
              <Link
                href="/incidencias"
                className="-mx-2 flex items-start justify-between gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-hundido"
              >
                <span className="min-w-0">
                  <span className="block font-semibold leading-snug">{incidencia.titulo}</span>
                  <span className="mt-0.5 block text-xs text-suave">
                    Desde el {formatoFecha(incidencia.creado_en)}
                  </span>
                </span>
                <EtiquetaEstado
                  estado={incidencia.prioridad === "urgente" ? "urgente" : incidencia.estado}
                  className="shrink-0"
                />
              </Link>
            </li>
          ))}
          {total > incidencias.length && (
            <li className="pt-1 text-sm text-suave">y {total - incidencias.length} más</li>
          )}
        </ul>
      ) : (
        <p className="mt-3 text-[15px] text-suave">
          {deLaComunidad
            ? "No hay incidencias abiertas."
            : "No tienes incidencias abiertas. Si ves algo que no funciona, repórtalo."}
        </p>
      )}
    </section>
  );
}

function cuandoVence(hoy: string, fecha: string) {
  const dias = diasEntre(hoy, fecha);
  if (dias < 0) return { texto: `Venció hace ${-dias} ${dias === -1 ? "día" : "días"}`, vencido: true };
  if (dias === 0) return { texto: "Vence hoy", vencido: true };
  if (dias === 1) return { texto: "Mañana", vencido: false };
  return { texto: `En ${dias} días`, vencido: false };
}

function TarjetaAtencion({ eventos, total, hoy }: { eventos: Evento[]; total: number; hoy: string }) {
  return (
    <section className="tarjeta">
      <CabeceraTarjeta
        titulo="Requiere atención"
        icono={CalendarClock}
        tono="bg-peligro-claro text-peligro"
        enlace={{ href: "/calendario", texto: "Calendario" }}
      />
      <p className="mt-1 text-sm text-suave">Lo vencido y lo que vence en los próximos {DIAS_ATENCION} días.</p>

      {eventos.length > 0 ? (
        <ul className="mt-3 divide-y divide-borde">
          {eventos.map((evento) => {
            const cuando = cuandoVence(hoy, evento.fecha);
            const contenido = (
              <>
                <span
                  className={cn(
                    "icono-seccion mt-0.5 size-8 shrink-0 rounded-lg",
                    cuando.vencido ? "bg-peligro-claro text-peligro" : "bg-hundido text-suave",
                  )}
                >
                  {cuando.vencido ? (
                    <AlertTriangle className="size-4" aria-hidden />
                  ) : (
                    <CalendarClock className="size-4" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug">{evento.titulo}</span>
                  <span className="mt-0.5 block text-xs text-suave">
                    <span className={cn("font-semibold", cuando.vencido && "text-peligro")}>
                      {cuando.texto}
                    </span>
                    {" · "}
                    {ETIQUETAS_EVENTO[evento.categoria]}
                    {evento.detalle ? ` · ${evento.detalle}` : ""}
                  </span>
                </span>
                {evento.href && <ChevronRight className="mt-1.5 size-4 shrink-0 text-suave" aria-hidden />}
              </>
            );
            return (
              <li key={evento.id}>
                {evento.href ? (
                  <Link
                    href={evento.href}
                    className="-mx-2 flex items-start gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-hundido"
                  >
                    {contenido}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 py-3">{contenido}</div>
                )}
              </li>
            );
          })}
          {total > eventos.length && (
            <li className="pt-3 text-sm text-suave">
              y {total - eventos.length} más en el{" "}
              <Link href="/calendario" className="font-semibold text-principal hover:underline">
                calendario
              </Link>
            </li>
          )}
        </ul>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-[15px] text-suave">
          <CheckCircle2 className="size-5 text-exito" aria-hidden />
          Nada pendiente en los próximos {DIAS_ATENCION} días.
        </p>
      )}
    </section>
  );
}

function TarjetaAnuncios({
  anuncios,
}: {
  anuncios: { id: string; titulo: string; contenido: string; publicado_en: string; fijado: boolean }[];
}) {
  return (
    <section className="tarjeta">
      <CabeceraTarjeta
        titulo="Últimos anuncios"
        icono={Megaphone}
        tono="bg-acento-claro text-acento"
        enlace={{ href: "/tablon", texto: "Ver todo" }}
      />
      {anuncios.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {anuncios.map((anuncio) => (
            <li key={anuncio.id}>
              <Link
                href="/tablon"
                className="-mx-2 block rounded-xl px-2 py-3 transition-colors hover:bg-hundido"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold leading-snug">{anuncio.titulo}</p>
                  {anuncio.fijado && (
                    <span className="chip shrink-0 bg-acento-claro text-acento">
                      <Pin className="size-3" aria-hidden />
                      Fijado
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-[15px] leading-relaxed text-suave">
                  {textoPlanoAnuncio(anuncio.contenido)}
                </p>
                <p className="mt-1.5 text-xs font-medium text-suave">{formatoFecha(anuncio.publicado_en)}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[15px] text-suave">Todavía no hay anuncios publicados.</p>
      )}
    </section>
  );
}
