import { requerirContexto } from "@/lib/auth";
import { cargarCalendario, ETIQUETAS_EVENTO } from "@/lib/calendario";
import { esAdministrador, puedeEditarFinanzas, puedeVerFinanzas } from "@/lib/permisos";
import { hoyISO } from "@/lib/recibos";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/** Texto escapado para iCalendar (RFC 5545). */
function escapar(texto: string) {
  return texto.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Corta las lineas a 75 octetos, como pide el formato. */
function plegar(linea: string) {
  const bytes = new TextEncoder().encode(linea);
  if (bytes.length <= 75) return linea;
  const partes: string[] = [];
  let actual = "";
  let tamano = 0;
  for (const caracter of linea) {
    const largo = new TextEncoder().encode(caracter).length;
    if (tamano + largo > (partes.length ? 74 : 75)) {
      partes.push(actual);
      actual = "";
      tamano = 0;
    }
    actual += caracter;
    tamano += largo;
  }
  partes.push(actual);
  return partes.join("\r\n ");
}

const sinGuiones = (fecha: string) => fecha.replaceAll("-", "");

function diaSiguiente(fecha: string) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** El calendario de la comunidad en formato .ics para importarlo en el movil. */
export async function GET(peticion: Request) {
  const { comunidad, permisos } = await requerirContexto();
  const junta =
    esAdministrador(permisos) || puedeEditarFinanzas(permisos) || puedeVerFinanzas(permisos);
  if (!junta) return new Response("No autorizado", { status: 403 });

  const supabase = await crearClienteServidor();
  const hoy = hoyISO();
  const eventos = await cargarCalendario(supabase, comunidad.id, hoy);
  const origen = new URL(peticion.url).origin;
  const sello = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mi Comunidad//Calendario//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapar(`Comunidad ${comunidad.nombre}`)}`,
  ];

  for (const evento of eventos) {
    const descripcion = [ETIQUETAS_EVENTO[evento.categoria], evento.detalle, evento.href ? `${origen}${evento.href}` : null]
      .filter(Boolean)
      .join("\n");
    lineas.push(
      "BEGIN:VEVENT",
      `UID:${evento.id}@mi-comunidad-${comunidad.id}`,
      `DTSTAMP:${sello}`,
      `DTSTART;VALUE=DATE:${sinGuiones(evento.fecha)}`,
      `DTEND;VALUE=DATE:${sinGuiones(diaSiguiente(evento.fecha))}`,
      `SUMMARY:${escapar(evento.titulo)}`,
      `DESCRIPTION:${escapar(descripcion)}`,
    );
    if (evento.obligacion?.cadaMeses) {
      lineas.push(`RRULE:FREQ=MONTHLY;INTERVAL=${evento.obligacion.cadaMeses}`);
    }
    if (evento.avisoDias > 0) {
      lineas.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapar(evento.titulo)}`, `TRIGGER:-P${evento.avisoDias}D`, "END:VALARM");
    }
    lineas.push("END:VEVENT");
  }
  lineas.push("END:VCALENDAR");

  return new Response(lineas.map(plegar).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="calendario-comunidad.ics"',
      "Cache-Control": "no-store",
    },
  });
}
