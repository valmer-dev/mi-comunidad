import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { cargarActa, type DatosActa } from "@/lib/datos-acta";
import { esAdministrador } from "@/lib/permisos";
import { hoyISO } from "@/lib/recibos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFecha } from "@/lib/utilidades";
import { BotonImprimir } from "@/components/ui/BotonImprimir";
import { ActaDocumento } from "@/components/juntas/ActaDocumento";

export const metadata = { title: "Libro de actas" };

/**
 * Todas las actas de la comunidad, en orden, para imprimirlas y llevarlas al
 * libro de actas diligenciado en el Registro de la Propiedad (art. 19.1 LPH).
 */
export default async function PaginaLibroActas() {
  const { comunidad, permisos } = await requerirContexto();
  if (!esAdministrador(permisos)) notFound();
  const supabase = await crearClienteServidor();

  const { data: juntas } = await supabase
    .from("juntas")
    .select("id")
    .eq("comunidad_id", comunidad.id)
    .in("estado", ["celebrada", "cerrada"])
    .order("fecha_hora");

  const hoy = hoyISO();
  const coeficienteTotal = Number(comunidad.coeficiente_total) || 100;
  const actas = (
    await Promise.all(
      (juntas ?? []).map((junta) => cargarActa(supabase, junta.id, comunidad.id, coeficienteTotal, hoy)),
    )
  ).filter((acta): acta is DatosActa => acta !== null);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-imprimir mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/juntas" className="inline-flex items-center gap-1.5 text-sm font-medium text-principal">
          <ArrowLeft className="size-4" aria-hidden />
          Juntas
        </Link>
        {actas.length > 0 && <BotonImprimir etiqueta="Imprimir el libro" />}
      </div>

      <div className="no-imprimir tarjeta mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <BookOpen className="size-5 text-principal" aria-hidden />
          Libro de actas
        </h1>
        <p className="mt-1 text-sm text-suave">
          Las actas de todas las juntas celebradas, en orden. Imprímelas (cada acta empieza en
          una hoja nueva) para pasarlas al libro de actas diligenciado en el Registro de la
          Propiedad, con la firma del presidente y del secretario.
        </p>
        {actas.length > 0 && (
          <ol className="mt-3 list-decimal space-y-0.5 pl-5 text-sm">
            {actas.map(({ junta }) => (
              <li key={junta.id}>
                {junta.titulo} · {formatoFecha(junta.fecha_hora)}
                {!junta.acta_firmada_en && <span className="text-suave"> (sin firmar)</span>}
              </li>
            ))}
          </ol>
        )}
      </div>

      {actas.length === 0 ? (
        <p className="text-sm text-suave">Todavía no hay juntas celebradas.</p>
      ) : (
        <div className="space-y-8">
          {actas.map((datos, indice) => (
            <div key={datos.junta.id} className={indice > 0 ? "print:break-before-page" : undefined}>
              <ActaDocumento datos={datos} comunidad={comunidad} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
