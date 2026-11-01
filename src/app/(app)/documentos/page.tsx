import { FileText, FolderOpen } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFechaCorta } from "@/lib/utilidades";
import { CabeceraPagina, EstadoVacio } from "@/components/ui/CabeceraPagina";

export const metadata = { title: "Documentos" };

export default async function PaginaDocumentos() {
  const { comunidad } = await requerirContexto();
  const supabase = await crearClienteServidor();

  const { data: documentos } = await supabase
    .from("documentos")
    .select("id, nombre, descripcion, carpeta, tipo_mime, tamano_bytes, creado_en")
    .eq("comunidad_id", comunidad.id)
    .order("creado_en", { ascending: false });

  const porCarpeta = new Map<string, Array<NonNullable<typeof documentos>[number]>>();
  for (const documento of documentos ?? []) {
    const lista = porCarpeta.get(documento.carpeta) ?? [];
    lista.push(documento);
    porCarpeta.set(documento.carpeta, lista);
  }

  return (
    <div>
      <CabeceraPagina
        titulo="Documentos"
        descripcion="Estatutos, actas, contratos y certificados"
      />

      {documentos && documentos.length > 0 ? (
        <div className="space-y-6">
          {[...porCarpeta.entries()].map(([carpeta, lista]) => (
            <section key={carpeta}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-suave">
                <FolderOpen className="size-4" aria-hidden />
                {carpeta}
              </h2>
              <ul className="space-y-2">
                {lista.map((documento) => (
                  <li
                    key={documento.id}
                    className="flex items-center gap-3 rounded-xl border border-borde bg-superficie px-4 py-3"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-principal/10 text-principal">
                      <FileText className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{documento.nombre}</p>
                      <p className="truncate text-xs text-suave">
                        {documento.descripcion ?? "Sin descripción"} ·{" "}
                        {formatoFechaCorta(documento.creado_en)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <EstadoVacio
          titulo="Todavía no hay documentos"
          descripcion="Aquí se guardarán las actas, los estatutos, los seguros y los contratos de la comunidad."
          accion={<FolderOpen className="size-8 text-suave/50" aria-hidden />}
        />
      )}
    </div>
  );
}
