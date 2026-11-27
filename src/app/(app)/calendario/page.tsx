import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, Download } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { cargarCalendario, ETIQUETAS_EVENTO, type Evento } from "@/lib/calendario";
import { esAdministrador, puedeEditarFinanzas, puedeVerFinanzas } from "@/lib/permisos";
import { diasEntre } from "@/lib/proveedores";
import { hoyISO } from "@/lib/recibos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { CabeceraPagina } from "@/components/ui/CabeceraPagina";
import { AccionesObligacion } from "./AccionesObligacion";
import { NuevaObligacion } from "./NuevaObligacion";

export const metadata = { title: "Calendario" };

const FECHA = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const PERIODO: Record<number, string> = { 1: "cada mes", 3: "cada 3 meses", 6: "cada 6 meses", 12: "cada año" };
function periodo(meses: number) {
  return PERIODO[meses] ?? (meses % 12 === 0 ? `cada ${meses / 12} años` : `cada ${meses} meses`);
}

/**
 * Calendario de obligaciones y vencimientos de la comunidad: lo que se da de
 * alta a mano y lo que sale del resto de la app (contratos, seguros, derramas,
 * juntas y actas).
 */
export default async function PaginaCalendario() {
  const { comunidad, permisos } = await requerirContexto();
  const editor = esAdministrador(permisos) || puedeEditarFinanzas(permisos);
  if (!editor && !puedeVerFinanzas(permisos)) redirect("/panel");

  const supabase = await crearClienteServidor();
  const hoy = hoyISO();
  const [eventos, { data: proveedores }] = await Promise.all([
    cargarCalendario(supabase, comunidad.id, hoy),
    supabase.from("proveedores").select("id, nombre, categoria").eq("comunidad_id", comunidad.id).order("nombre"),
  ]);

  const grupos: { titulo: string; eventos: Evento[]; tono?: string }[] = [
    { titulo: "Vencido o pendiente", eventos: [], tono: "text-peligro" },
    { titulo: "En los próximos 30 días", eventos: [] },
    { titulo: "En los próximos 3 meses", eventos: [] },
    { titulo: "Más adelante", eventos: [] },
  ];
  for (const evento of eventos) {
    const dias = diasEntre(hoy, evento.fecha);
    if (dias < 0) grupos[0].eventos.push(evento);
    else if (dias <= 30) grupos[1].eventos.push(evento);
    else if (dias <= 92) grupos[2].eventos.push(evento);
    else grupos[3].eventos.push(evento);
  }

  return (
    <div>
      <CabeceraPagina
        titulo="Calendario"
        icono={CalendarClock}
        descripcion="Inspecciones, revisiones, impuestos, contratos, seguros, juntas y cobros, en un solo sitio"
        accion={
          editor ? (
            <NuevaObligacion
              hoy={hoy}
              proveedores={(proveedores ?? []).map((p) => ({
                id: p.id,
                nombre: p.categoria ? `${p.nombre} (${p.categoria})` : p.nombre,
              }))}
            />
          ) : undefined
        }
      />

      <p className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <a href="/calendario/ics" className="inline-flex items-center gap-1.5 font-medium text-principal hover:underline">
          <Download className="size-4" aria-hidden />
          Descargar para el calendario del móvil (.ics)
        </a>
        <span className="text-xs text-suave">
          Se importa una vez en Google Calendar, Outlook o el calendario del iPhone; si añades cosas nuevas, descárgalo de nuevo.
        </span>
      </p>

      {eventos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borde bg-superficie px-4 py-6 text-center text-sm text-suave">
          No hay nada en el calendario. Añade las inspecciones y revisiones del edificio con «Añadir obligación».
        </p>
      ) : (
        <div className="space-y-8">
          {grupos
            .filter((g) => g.eventos.length > 0)
            .map((grupo) => (
              <section key={grupo.titulo}>
                <h2 className={`sobretitulo mb-3 ${grupo.tono ?? ""}`}>
                  {grupo.titulo} ({grupo.eventos.length})
                </h2>
                <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
                  {grupo.eventos.map((evento) => {
                    const dias = diasEntre(hoy, evento.fecha);
                    const cerca = dias >= 0 && dias <= evento.avisoDias;
                    return (
                      <li key={evento.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                        <div className="w-28 shrink-0 text-sm">
                          <p className={dias < 0 ? "font-semibold text-peligro" : cerca ? "font-semibold text-atencion" : "font-medium"}>
                            {FECHA.format(new Date(`${evento.fecha}T00:00:00Z`))}
                          </p>
                          <p className="text-xs text-suave">
                            {dias === 0 ? "hoy" : dias < 0 ? `hace ${-dias} días` : `en ${dias} días`}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {evento.href ? (
                              <Link href={evento.href} className="hover:underline">
                                {evento.titulo}
                              </Link>
                            ) : (
                              evento.titulo
                            )}
                          </p>
                          <p className="text-xs text-suave">
                            <span className="rounded-full bg-hundido px-2 py-0.5 font-medium text-tinta/80">
                              {ETIQUETAS_EVENTO[evento.categoria]}
                            </span>
                            {evento.obligacion?.cadaMeses && ` · ${periodo(evento.obligacion.cadaMeses)}`}
                            {evento.obligacion?.ultimaVez &&
                              ` · última vez el ${FECHA.format(new Date(`${evento.obligacion.ultimaVez}T00:00:00Z`))}`}
                          </p>
                          {evento.detalle && <p className="mt-0.5 text-sm text-suave">{evento.detalle}</p>}
                        </div>
                        {editor && evento.obligacion && (
                          <AccionesObligacion
                            id={evento.obligacion.id}
                            titulo={evento.titulo}
                            repite={Boolean(evento.obligacion.cadaMeses)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
