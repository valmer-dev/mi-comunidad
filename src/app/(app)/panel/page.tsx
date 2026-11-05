import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Megaphone,
  Plus,
  ReceiptText,
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

  const [
    { count: totalVecinos },
    { count: incidenciasAbiertas },
    { data: recibosPendientes },
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
      .from("recibos")
      .select("importe")
      .eq("comunidad_id", comunidad.id)
      .eq("estado", "pendiente"),
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

  const pendiente = (recibosPendientes ?? []).reduce(
    (total, recibo) => total + Number(recibo.importe),
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
    },
    {
      etiqueta: "Incidencias abiertas",
      valor: String(incidenciasAbiertas ?? 0),
      icono: Wrench,
      href: "/incidencias",
    },
    verFinanzas
      ? {
          etiqueta: "Pendiente de cobro",
          valor: formatoMoneda(pendiente),
          icono: Wallet,
          href: "/finanzas",
        }
      : {
          etiqueta: "Mis recibos pendientes",
          valor: formatoMoneda(pendiente),
          icono: ReceiptText,
          href: "/finanzas",
        },
    {
      etiqueta: "Próxima junta",
      valor: proximaJunta ? formatoFecha(proximaJunta.fecha_hora) : "Sin convocar",
      icono: CalendarDays,
      href: "/juntas",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm capitalize text-suave">{hoy}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Hola, {perfil?.nombre?.trim() || "vecino"}
        </h1>
        <p className="mt-1 text-sm text-suave">
          {comunidad.nombre}
          {comunidad.direccion ? ` · ${comunidad.direccion}` : ""}
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {indicadores.map(({ etiqueta, valor, icono: Icono, href }) => (
          <Link
            key={etiqueta}
            href={href}
            className="tarjeta group p-4 transition-shadow hover:shadow-md"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-principal/10 text-principal">
              <Icono className="size-[18px]" aria-hidden />
            </span>
            <p className="mt-3 truncate text-lg font-bold leading-tight sm:text-xl">{valor}</p>
            <p className="mt-0.5 text-xs leading-snug text-suave">{etiqueta}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="tarjeta lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Megaphone className="size-4.5 text-principal" aria-hidden />
              Últimos anuncios
            </h2>
            <Link
              href="/tablon"
              className="flex items-center gap-1 text-sm font-medium text-principal hover:underline"
            >
              Ver tablón <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>

          {anuncios && anuncios.length > 0 ? (
            <ul className="mt-4 divide-y divide-borde">
              {anuncios.map((anuncio) => (
                <li key={anuncio.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold leading-snug">{anuncio.titulo}</p>
                    {anuncio.fijado && (
                      <span className="chip shrink-0 bg-acento-claro text-acento">Fijado</span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-suave">
                    {textoPlanoAnuncio(anuncio.contenido)}
                  </p>
                  <p className="mt-1.5 text-xs text-suave">
                    {formatoFecha(anuncio.publicado_en)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-suave">
              Todavía no hay anuncios publicados.
            </p>
          )}
        </section>

        <aside className="space-y-5">
          <section className="tarjeta">
            <h2 className="text-base font-bold">Próxima junta</h2>
            {proximaJunta ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-semibold leading-snug">{proximaJunta.titulo}</p>
                <p className="text-sm text-suave">{formatoFechaHora(proximaJunta.fecha_hora)}</p>
                {proximaJunta.lugar && (
                  <p className="text-sm text-suave">{proximaJunta.lugar}</p>
                )}
                <EtiquetaEstado estado={proximaJunta.estado} />
                <Link
                  href="/juntas"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-principal hover:underline"
                >
                  Ver detalle <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            ) : (
              <p className="mt-2 text-sm text-suave">No hay ninguna junta convocada.</p>
            )}
          </section>

          <section className="tarjeta">
            <h2 className="text-base font-bold">Acciones rápidas</h2>
            <div className="mt-3 grid gap-2">
              <Link href="/incidencias" className="boton boton-suave justify-start">
                <Plus className="size-4" aria-hidden />
                Reportar una incidencia
              </Link>
              <Link href="/tablon" className="boton boton-borde justify-start">
                <Megaphone className="size-4" aria-hidden />
                Leer el tablón
              </Link>
              {verFinanzas && (
                <Link href="/finanzas" className="boton boton-borde justify-start">
                  <Wallet className="size-4" aria-hidden />
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
