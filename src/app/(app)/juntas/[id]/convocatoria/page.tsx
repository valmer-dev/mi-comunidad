import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { diaMadrid } from "@/lib/convocatoria";
import { hoyISO } from "@/lib/recibos";
import { cargarConvocatoria } from "@/lib/datos-convocatoria";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { BotonImprimir } from "@/components/ui/BotonImprimir";

export const metadata = { title: "Convocatoria" };

const FECHA_LARGA = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
});
const HORA = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});
const FECHA_FIRMA = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
});

/**
 * Convocatoria lista para imprimir o guardar en PDF, con el contenido del
 * art. 16.2 LPH y un modelo de representacion al pie.
 */
export default async function PaginaConvocatoria(props: PageProps<"/juntas/[id]/convocatoria">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { comunidad } = await requerirContexto();
  const supabase = await crearClienteServidor();
  const datos = await cargarConvocatoria(supabase, id, comunidad.id);
  if (!datos) notFound();
  const { junta, puntos, morosos, presidente } = datos;

  const inicio = new Date(junta.fecha_hora);
  const segunda = new Date(inicio.getTime() + junta.segunda_convocatoria_minutos * 60_000);
  const fechaFirma = new Date(junta.convocatoria_enviada_en ?? `${hoyISO()}T12:00:00Z`);
  const direccion = [comunidad.direccion, [comunidad.codigo_postal, comunidad.ciudad].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const mismoDia = diaMadrid(inicio) === diaMadrid(segunda);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-imprimir mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/juntas/${junta.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-principal">
          <ArrowLeft className="size-4" aria-hidden />
          Volver a la junta
        </Link>
        <BotonImprimir />
      </div>

      <article className="tarjeta space-y-5 p-6 text-[15px] leading-relaxed sm:p-10 print:border-0 print:p-0 print:shadow-none">
        <header className="border-b border-borde pb-4">
          <p className="font-titulo text-lg font-semibold">Comunidad de Propietarios {comunidad.nombre}</p>
          {direccion && <p className="text-sm text-suave">{direccion}</p>}
          {comunidad.cif && <p className="text-sm text-suave">CIF {comunidad.cif}</p>}
        </header>

        <h1 className="text-center text-xl font-semibold uppercase tracking-wide">
          Convocatoria de junta general {junta.tipo}
        </h1>

        <p>
          {presidente ? (
            <>
              Por indicación de <strong>{presidente}</strong>, presidente de la comunidad,
            </>
          ) : (
            "Por indicación de la presidencia de la comunidad,"
          )}{" "}
          se convoca a todos los propietarios a la junta general {junta.tipo} que se celebrará el{" "}
          <strong>{FECHA_LARGA.format(inicio)}</strong>, a las <strong>{HORA.format(inicio)}</strong> en
          primera convocatoria
          {junta.segunda_convocatoria_minutos > 0 && (
            <>
              {" "}
              y, si no hubiera quórum, a las <strong>{HORA.format(segunda)}</strong>
              {!mismoDia && ` del ${FECHA_LARGA.format(segunda)}`} en segunda convocatoria
            </>
          )}
          {junta.lugar ? (
            <>
              , en <strong>{junta.lugar}</strong>
            </>
          ) : null}
          , con el siguiente orden del día:
        </p>

        <section>
          {puntos.length > 0 ? (
            <ol className="list-decimal space-y-1.5 pl-6">
              {puntos.map((punto) => (
                <li key={punto.id}>
                  <span className="font-medium">{punto.titulo}</span>
                  {punto.descripcion && (
                    <span className="block whitespace-pre-line text-sm text-suave">{punto.descripcion}</span>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-suave">Pendiente de completar.</p>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-semibold">Propietarios que no están al corriente de pago</h2>
          {morosos.length > 0 ? (
            <>
              <p>
                Según el artículo 16.2 de la Ley de Propiedad Horizontal, se relacionan los
                propietarios que, a la fecha de la junta, no están al corriente en el pago de las
                deudas vencidas con la comunidad. Podrán asistir y participar en las
                deliberaciones, pero no votar, salvo que antes de la junta paguen o consignen la
                deuda (art. 15.2).
              </p>
              <ul className="mt-2 list-disc space-y-0.5 pl-6">
                {morosos.map((moroso) => (
                  <li key={moroso.fincaId}>
                    {moroso.codigo}
                    {moroso.titulares.length > 0 && ` · ${moroso.titulares.join(", ")}`}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>A la fecha de esta convocatoria, todos los propietarios están al corriente de pago.</p>
          )}
        </section>

        <p>
          Los propietarios pueden asistir personalmente o por medio de representante, bastando
          para ello un escrito firmado (art. 15.1 LPH). Se adjunta un modelo al pie.
        </p>

        <div className="pt-4">
          <p>
            {comunidad.ciudad ? `En ${comunidad.ciudad}, a` : "A"} {FECHA_FIRMA.format(fechaFirma)}.
          </p>
          <p className="mt-10">El presidente{presidente ? `, ${presidente}` : ""}</p>
        </div>

        <section className="mt-8 border-t-2 border-dashed border-borde-fuerte pt-6 print:break-inside-avoid">
          <h2 className="mb-3 font-semibold">Modelo de representación</h2>
          <p>
            D./D.ª ______________________________________, propietario/a de la finca ________ de
            la Comunidad de Propietarios {comunidad.nombre}, delega su representación y voto en
            D./D.ª ______________________________________ para la junta general {junta.tipo} del{" "}
            {FECHA_FIRMA.format(inicio)}.
          </p>
          <p className="mt-8">Firma: ______________________ &nbsp;&nbsp; Fecha: ____________</p>
        </section>
      </article>
    </div>
  );
}
