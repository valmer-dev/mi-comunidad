import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { cargarActa } from "@/lib/datos-acta";
import { esAdministrador } from "@/lib/permisos";
import { hoyISO } from "@/lib/recibos";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { BotonImprimir } from "@/components/ui/BotonImprimir";
import { ActaDocumento } from "@/components/juntas/ActaDocumento";

export const metadata = { title: "Acta" };

/**
 * Acta generada con lo registrado en la app, lista para imprimir o guardar
 * en PDF y firmar. Los vecinos la ven cuando se ha notificado o la junta
 * está cerrada.
 */
export default async function PaginaActa(props: PageProps<"/juntas/[id]/acta">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { comunidad, permisos } = await requerirContexto();
  const administrador = esAdministrador(permisos);
  const supabase = await crearClienteServidor();
  const datos = await cargarActa(supabase, id, comunidad.id, Number(comunidad.coeficiente_total) || 100, hoyISO());
  if (!datos) notFound();
  const { junta } = datos;

  const visible =
    junta.estado === "cerrada" ||
    Boolean(junta.acta_notificada_en) ||
    (administrador && junta.estado === "celebrada");
  if (!visible) notFound();

  let enlacePdf: string | null = null;
  if (junta.acta_documento_id) {
    const { data: documento } = await supabase
      .from("documentos")
      .select("ruta_almacenamiento")
      .eq("id", junta.acta_documento_id)
      .maybeSingle();
    if (documento?.ruta_almacenamiento) {
      const { data } = await crearClienteAdmin()
        .storage.from("documentos")
        .createSignedUrl(documento.ruta_almacenamiento, 60 * 60);
      enlacePdf = data?.signedUrl ?? null;
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-imprimir mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/juntas/${junta.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-principal">
          <ArrowLeft className="size-4" aria-hidden />
          Volver a la junta
        </Link>
        <div className="flex flex-wrap gap-2">
          {enlacePdf && (
            <a href={enlacePdf} target="_blank" rel="noreferrer" className="boton boton-borde px-3 py-1.5 text-sm">
              <FileText className="size-4" aria-hidden />
              Acta firmada (PDF)
            </a>
          )}
          <BotonImprimir />
        </div>
      </div>

      {!junta.acta_firmada_en && (
        <p className="no-imprimir aviso aviso-atencion mb-4">
          Borrador: el acta todavía no está cerrada ni firmada.
        </p>
      )}

      <ActaDocumento datos={datos} comunidad={comunidad} />
    </div>
  );
}
