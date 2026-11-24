import { Megaphone, Pin } from "lucide-react";
import { eliminarAnuncio } from "@/app/acciones/tablon";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFecha } from "@/lib/utilidades";
import { BotonEliminar } from "@/components/ui/BotonEliminar";
import { CabeceraPagina, EstadoVacio } from "@/components/ui/CabeceraPagina";
import { ContenidoAnuncio } from "@/components/ui/ContenidoAnuncio";
import { NuevoAnuncio } from "./NuevoAnuncio";

export const metadata = { title: "Tablón" };

export default async function PaginaTablón() {
  const { comunidad, permisos } = await requerirContexto();
  const supabase = await crearClienteServidor();
  const administrador = esAdministrador(permisos);

  const { data: anuncios } = await supabase
    .from("anuncios")
    .select("id, titulo, contenido, fijado, publicado_en, autor_id")
    .eq("comunidad_id", comunidad.id)
    .order("fijado", { ascending: false })
    .order("publicado_en", { ascending: false });

  const idsAutores = [...new Set((anuncios ?? []).map((a) => a.autor_id).filter(Boolean))];
  const { data: autores } = idsAutores.length
    ? await supabase.from("perfiles").select("id, nombre").in("id", idsAutores as string[])
    : { data: [] };
  const mapaAutores = new Map((autores ?? []).map((a) => [a.id, a.nombre]));

  return (
    <div>
      <CabeceraPagina
        titulo="Tablón"
        icono={Megaphone}
        descripcion="Avisos y comunicados de la comunidad"
        accion={administrador ? <NuevoAnuncio /> : undefined}
      />

      {anuncios && anuncios.length > 0 ? (
        <ul className="space-y-3">
          {anuncios.map((anuncio) => (
            <li key={anuncio.id} className="tarjeta">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-[17px] font-semibold leading-snug">{anuncio.titulo}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  {anuncio.fijado && (
                    <span className="chip bg-acento-claro text-acento">
                      <Pin className="size-3" aria-hidden />
                      Fijado
                    </span>
                  )}
                  {administrador && (
                    <BotonEliminar
                      accion={eliminarAnuncio}
                      id={anuncio.id}
                      etiqueta="Eliminar"
                      titulo="Eliminar anuncio"
                      mensaje={`¿Eliminar el anuncio «${anuncio.titulo}»? Esta acción no se puede deshacer.`}
                    />
                  )}
                </div>
              </div>
              <ContenidoAnuncio
                contenido={anuncio.contenido}
                className="mt-2 text-[15px] leading-relaxed text-tinta/90"
              />
              <p className="mt-3 text-xs text-suave">
                {formatoFecha(anuncio.publicado_en)}
                {anuncio.autor_id ? ` · ${mapaAutores.get(anuncio.autor_id) ?? "Junta"}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVacio
          titulo="El tablón está vacío"
          descripcion="Cuando la junta publique un aviso aparecerá aquí."
          accion={
            <Megaphone className="size-9 text-principal/40" aria-hidden />
          }
        />
      )}
    </div>
  );
}
