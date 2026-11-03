import {
  BadgeCheck,
  Calculator,
  Download,
  FileSignature,
  FileText,
  Scale,
  ScrollText,
} from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import {
  CATEGORIAS_DOCUMENTOS,
  type CategoriaDocumento,
  DESCRIPCION_CATEGORIA,
  esCategoriaDocumento,
} from "@/lib/documentos";
import { puedeGestionarDocumentos } from "@/lib/permisos";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFechaCorta, formatoTamano } from "@/lib/utilidades";
import { CabeceraPagina } from "@/components/ui/CabeceraPagina";
import { SubirDocumento } from "./SubirDocumento";

export const metadata = { title: "Documentos" };

const ICONOS = {
  Estatutos: Scale,
  Actas: ScrollText,
  Contratos: FileSignature,
  Certificados: BadgeCheck,
  Presupuestos: Calculator,
} satisfies Record<CategoriaDocumento, typeof FileText>;

export default async function PaginaDocumentos() {
  const { comunidad, permisos } = await requerirContexto();
  const supabase = await crearClienteServidor();

  const { data: documentos } = await supabase
    .from("documentos")
    .select(
      "id, nombre, descripcion, carpeta, ruta_almacenamiento, tamano_bytes, subido_por, creado_en",
    )
    .eq("comunidad_id", comunidad.id)
    .order("creado_en", { ascending: false });

  type Documento = NonNullable<typeof documentos>[number];

  const documentosPorCategoria: Record<CategoriaDocumento, Documento[]> = {
    Estatutos: [],
    Actas: [],
    Contratos: [],
    Certificados: [],
    Presupuestos: [],
  };

  for (const documento of documentos ?? []) {
    const categoria = esCategoriaDocumento(documento.carpeta)
      ? documento.carpeta
      : "Estatutos";
    documentosPorCategoria[categoria].push(documento);
  }

  // Enlaces temporales para abrir los PDF (el bucket es privado).
  const rutas = (documentos ?? [])
    .map((documento) => documento.ruta_almacenamiento)
    .filter((ruta): ruta is string => Boolean(ruta));

  const enlaces = new Map<string, string>();

  if (rutas.length > 0) {
    const admin = crearClienteAdmin();
    const { data: firmadas } = await admin.storage
      .from("documentos")
      .createSignedUrls(rutas, 60 * 60);

    for (const firmada of firmadas ?? []) {
      const url = firmada.signedUrl ?? firmada.signedURL;
      if (firmada.path && url) enlaces.set(firmada.path, url);
    }
  }

  // Quien subio cada documento.
  const idsSubidores = [
    ...new Set(
      (documentos ?? [])
        .map((documento) => documento.subido_por)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: perfiles } = idsSubidores.length
    ? await supabase
        .from("perfiles")
        .select("id, nombre, apellidos")
        .in("id", idsSubidores)
    : { data: [] };

  const mapaPerfiles = new Map((perfiles ?? []).map((perfil) => [perfil.id, perfil]));

  function nombreSubidor(id: string | null) {
    if (!id) return null;
    const perfil = mapaPerfiles.get(id);
    return [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(" ") || null;
  }

  const puedeSubir = puedeGestionarDocumentos(permisos);

  return (
    <div>
      <CabeceraPagina
        titulo="Documentos"
        descripcion="Estatutos, actas, contratos, certificados y presupuestos"
        accion={puedeSubir ? <SubirDocumento /> : undefined}
      />

      <div className="space-y-6">
        {CATEGORIAS_DOCUMENTOS.map((categoria) => {
          const Icono = ICONOS[categoria];
          const lista = documentosPorCategoria[categoria];

          return (
            <section key={categoria}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <span className="grid size-8 place-items-center rounded-lg bg-principal/10 text-principal">
                    <Icono className="size-4" aria-hidden />
                  </span>
                  {categoria}
                  <span className="rounded-full bg-fondo px-2 py-0.5 text-xs font-semibold text-suave">
                    {lista.length}
                  </span>
                </h2>
              </div>

              {lista.length > 0 ? (
                <ul className="space-y-2">
                  {lista.map((documento) => {
                    const enlace = documento.ruta_almacenamiento
                      ? enlaces.get(documento.ruta_almacenamiento)
                      : undefined;
                    const subidor = nombreSubidor(documento.subido_por);
                    const detalles = [
                      "PDF",
                      formatoTamano(documento.tamano_bytes),
                      formatoFechaCorta(documento.creado_en),
                      subidor ? `Subido por ${subidor}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <li
                        key={documento.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-borde bg-superficie px-4 py-3"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-principal/10 text-principal">
                          <FileText className="size-4" aria-hidden />
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{documento.nombre}</p>
                          <p className="truncate text-xs text-suave">
                            {documento.descripcion ? `${documento.descripcion} · ` : ""}
                            {detalles}
                          </p>
                        </div>

                        {enlace && (
                          <a
                            href={enlace}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="boton boton-borde"
                          >
                            <Download className="size-4" aria-hidden />
                            Ver PDF
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed border-borde px-4 py-3 text-sm text-suave">
                  {DESCRIPCION_CATEGORIA[categoria]}. Todavía no hay documentos.
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
