import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  FolderOpen,
  Megaphone,
  Pin,
  Plus,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { textoPlanoAnuncio } from "@/lib/anuncios";
import { puedeVerFinanzas } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFecha, formatoFechaHora, formatoMoneda } from "@/lib/utilidades";
import { EtiquetaEstado } from "@/components/ui/EtiquetaEstado";

export const metadata = { title: "Panel" };

export default async function PaginaPanel() {
  const { perfil, comunidad, permisos } = await requerirContexto();
  const supabase = await crearClienteServidor();
  const verFinanzas = puedeVerFinanzas(permisos);
  const ejercicio = new Date().getFullYear();

  const [
    { count: totalVecinos },
    { count: incidenciasAbiertas },
    { data: gastosAnio },
    { data: proximaJunta },
    { data: anuncios },
  ] = await Promise.all([
    supabase
      .from("miembros")
      .select("*", { count: "exact", head: true })
      .eq("comunidad_id", comunidad.id)
      .eq("estado", "activo"),
    supabase
      .from("incidencias")
      .select("*", { count: "exact", head: true })
      .eq("comunidad_id", comunidad.id)
      .in("estado", ["abierta", "en_curso"]),
    supabase
      .from("gastos")
      .select("total")
      .eq("comunidad_id", comunidad.id)
      .gte("fecha", `${ejercicio}-01-01`)
      .lte("fecha", `${ejercicio}-12-31`),
    supabase
      .from("juntas")
      .select("*")
      .eq("comunidad_id", comunidad.id)
      .gte("fecha_hora", new Date().toISOString())
      .neq("estado", "cerrada")
      .order("fecha_hora", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("anuncios")
      .select("id, titulo, contenido, publicado_en, fijado")
      .eq("comunidad_id", comunidad.id)
      .order("fijado", { ascending: false })
      .order("publicado_en", { ascending: false })
      .limit(3),
  ]);

  const gastadoAnio = (gastosAnio ?? []).reduce(
    (total, gasto) => total + Number(gasto.total),
    0,
  );

  const hoy = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const indicadores = [
    {
      etiqueta: "Vecinos activos",
      valor: String(totalVecinos ?? 0),
      icono: Users,
      href: "/vecinos",
      tono: "bg-info-claro text-info",
    },
    {
      etiqueta: "Incidencias abiertas",
      valor: String(incidenciasAbiertas ?? 0),
      icono: Wrench,
      href: "/incidencias",
      tono: "bg-atencion-claro text-atencion",
    },
    ...(verFinanzas
      ? [
          {
            etiqueta: "Gastado este año",
            valor: formatoMoneda(gastadoAnio),
            icono: Wallet,
            href: "/finanzas",
            tono: "bg-exito-claro text-exito",
          },
        ]
      : []),
    {
      etiqueta: "Próxima junta",
      valor: proximaJunta ? formatoFecha(proximaJunta.fecha_hora) : "Sin convocar",
      icono: CalendarDays,
      href: "/juntas",
      tono: "bg-principal/10 text-principal",
    },
  ];

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
          <p className="text-sm font-medium text-white/75 first-letter:uppercase">{hoy}</p>
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

      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {indicadores.map(({ etiqueta, valor, icono: Icono, href, tono }) => (
          <Link
            key={etiqueta}
            href={href}
            className="tarjeta tarjeta-enlace group flex flex-col p-4"
          >
            <div className="flex items-center justify-between">
              <span className={`icono-seccion size-10 ${tono}`}>
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
            <p className="mt-1 text-sm leading-snug text-suave">{etiqueta}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        <section className="tarjeta lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2.5 text-lg font-semibold">
              <span className="icono-seccion size-8 rounded-lg bg-acento-claro text-acento">
                <Megaphone className="size-4" aria-hidden />
              </span>
              Últimos anuncios
            </h2>
            <Link
              href="/tablon"
              className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-principal hover:bg-principal/10"
            >
              Ver todo <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>

          {anuncios && anuncios.length > 0 ? (
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
                    <p className="mt-1.5 text-xs font-medium text-suave">
                      {formatoFecha(anuncio.publicado_en)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[15px] text-suave">
              Todavía no hay anuncios publicados.
            </p>
          )}
        </section>

        <aside className="space-y-5">
          <section className="tarjeta">
            <h2 className="flex items-center gap-2.5 text-lg font-semibold">
              <span className="icono-seccion size-8 rounded-lg bg-principal/10 text-principal">
                <CalendarDays className="size-4" aria-hidden />
              </span>
              Próxima junta
            </h2>
            {proximaJunta ? (
              <div className="mt-4 space-y-2">
                <p className="font-semibold leading-snug">{proximaJunta.titulo}</p>
                <p className="text-[15px] text-suave">{formatoFechaHora(proximaJunta.fecha_hora)}</p>
                {proximaJunta.lugar && (
                  <p className="text-[15px] text-suave">{proximaJunta.lugar}</p>
                )}
                <EtiquetaEstado estado={proximaJunta.estado} />
                <Link
                  href="/juntas"
                  className="boton boton-suave mt-2 w-full"
                >
                  Ver detalle <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-[15px] text-suave">No hay ninguna junta convocada.</p>
            )}
          </section>

          <section className="tarjeta">
            <h2 className="text-lg font-semibold">Acciones rápidas</h2>
            <div className="mt-3 grid gap-2">
              <Link href="/incidencias" className="boton boton-borde justify-start">
                <Wrench className="size-4 text-atencion" aria-hidden />
                Reportar una incidencia
              </Link>
              <Link href="/documentos" className="boton boton-borde justify-start">
                <FolderOpen className="size-4 text-info" aria-hidden />
                Consultar documentos
              </Link>
              {verFinanzas && (
                <Link href="/finanzas" className="boton boton-borde justify-start">
                  <Wallet className="size-4 text-exito" aria-hidden />
                  Consultar finanzas
                </Link>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
