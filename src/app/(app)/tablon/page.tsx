import { Eye, Megaphone, Pin } from "lucide-react";
import { eliminarAnuncio } from "@/app/acciones/tablon";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFecha } from "@/lib/utilidades";
import { BotonEliminar } from "@/components/ui/BotonEliminar";
import { CabeceraPagina, EstadoVacio } from "@/components/ui/CabeceraPagina";
import { ContenidoAnuncio } from "@/components/ui/ContenidoAnuncio";
import { MarcarLeidos } from "./MarcarLeidos";
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

  // La junta ve quién ha leído cada anuncio y quién no.
  const idsAnuncios = (anuncios ?? []).map((anuncio) => anuncio.id);
  const [{ data: lecturas }, { data: miembros }] =
    administrador && idsAnuncios.length
      ? await Promise.all([
          supabase.from("lecturas_anuncio").select("anuncio_id, usuario_id").in("anuncio_id", idsAnuncios),
          supabase
            .from("miembros")
            .select("usuario_id, perfiles(nombre, apellidos)")
            .eq("comunidad_id", comunidad.id)
            .eq("estado", "activo"),
        ])
      : [{ data: [] }, { data: [] }];
  const vecinos = (miembros ?? []).map((miembro) => ({
    id: miembro.usuario_id,
    nombre:
      [miembro.perfiles?.nombre, miembro.perfiles?.apellidos].filter(Boolean).join(" ") || "Vecino",
  }));
  const lectoresPorAnuncio = new Map<string, Set<string>>();
  for (const lectura of lecturas ?? []) {
    const lectores = lectoresPorAnuncio.get(lectura.anuncio_id) ?? new Set<string>();
    lectores.add(lectura.usuario_id);
    lectoresPorAnuncio.set(lectura.anuncio_id, lectores);
  }

  return (
    <div>
      <CabeceraPagina
        titulo="Tablón"
        icono={Megaphone}
        descripcion="Avisos y comunicados de la comunidad"
        accion={administrador ? <NuevoAnuncio /> : undefined}
      />

      <MarcarLeidos ids={idsAnuncios} />

      {anuncios && anuncios.length > 0 ? (
        <ul className="space-y-3">
          {anuncios.map((anuncio) => (
            <li key={anuncio.id} id={`anuncio-${anuncio.id}`} className="tarjeta scroll-mt-24">
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
              {administrador && vecinos.length > 0 && (
                <Lecturas
                  vecinos={vecinos}
                  lectores={lectoresPorAnuncio.get(anuncio.id) ?? new Set()}
                  autorId={anuncio.autor_id}
                />
              )}
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

function Lecturas({
  vecinos,
  lectores,
  autorId,
}: {
  vecinos: { id: string; nombre: string }[];
  lectores: Set<string>;
  autorId: string | null;
}) {
  // Quien publica no cuenta: ya sabe lo que dice.
  const destinatarios = vecinos.filter((vecino) => vecino.id !== autorId);
  const leido = destinatarios.filter((vecino) => lectores.has(vecino.id));
  const pendiente = destinatarios.filter((vecino) => !lectores.has(vecino.id));
  if (destinatarios.length === 0) return null;

  return (
    <details className="mt-3 rounded-xl bg-hundido/60 px-3 py-2 text-xs text-suave">
      <summary className="flex cursor-pointer items-center gap-1.5 font-medium">
        <Eye className="size-3.5" aria-hidden />
        Leído por {leido.length} de {destinatarios.length}
      </summary>
      <div className="mt-2 space-y-1.5">
        {leido.length > 0 && (
          <p>
            <span className="font-semibold text-tinta">Lo han visto:</span>{" "}
            {leido.map((vecino) => vecino.nombre).join(", ")}
          </p>
        )}
        {pendiente.length > 0 && (
          <p>
            <span className="font-semibold text-tinta">Aún no:</span>{" "}
            {pendiente.map((vecino) => vecino.nombre).join(", ")}
          </p>
        )}
      </div>
    </details>
  );
}
