import Link from "next/link";
import { CalendarDays, ChevronRight, FileText, Gavel, MapPin, BookOpen } from "lucide-react";
import { eliminarJunta } from "@/app/acciones/juntas";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFechaHora } from "@/lib/utilidades";
import { BotonEliminar } from "@/components/ui/BotonEliminar";
import { CabeceraPagina, EstadoVacio } from "@/components/ui/CabeceraPagina";
import { EtiquetaEstado } from "@/components/ui/EtiquetaEstado";
import { NuevaJunta } from "./NuevaJunta";

export const metadata = { title: "Juntas" };

export default async function PaginaJuntas() {
  const { comunidad, permisos } = await requerirContexto();
  const supabase = await crearClienteServidor();
  const administrador = esAdministrador(permisos);

  const { data: juntas } = await supabase
    .from("juntas")
    .select("id, titulo, tipo, fecha_hora, lugar, estado, acta_documento_id")
    .eq("comunidad_id", comunidad.id)
    .order("fecha_hora", { ascending: false });

  const ids = (juntas ?? []).map((j) => j.id);
  const { data: puntos } = ids.length
    ? await supabase
        .from("puntos_del_dia")
        .select("id, junta_id, posicion, titulo, tipo, resultado")
        .in("junta_id", ids)
        .order("posicion")
    : { data: [] };

  const puntosPorJunta = new Map<string, Array<NonNullable<typeof puntos>[number]>>();
  for (const punto of puntos ?? []) {
    const lista = puntosPorJunta.get(punto.junta_id) ?? [];
    lista.push(punto);
    puntosPorJunta.set(punto.junta_id, lista);
  }

  const ahora = new Date().getTime();
  const futuras = (juntas ?? []).filter(
    (j) => new Date(j.fecha_hora).getTime() >= ahora && j.estado !== "cerrada",
  );
  const pasadas = (juntas ?? []).filter((j) => !futuras.includes(j));

  function Tarjeta({ junta }: { junta: NonNullable<typeof juntas>[number] }) {
    const listaPuntos = puntosPorJunta.get(junta.id) ?? [];
    return (
      <li className="tarjeta">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-[17px] font-semibold leading-snug">
              <Link href={`/juntas/${junta.id}`} className="hover:text-principal">
                {junta.titulo}
              </Link>
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-suave">
              <CalendarDays className="size-3.5" aria-hidden />
              {formatoFechaHora(junta.fecha_hora)}
            </p>
            {junta.lugar && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-suave">
                <MapPin className="size-3.5" aria-hidden />
                {junta.lugar}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-neutro-claro capitalize text-neutro">{junta.tipo}</span>
            <EtiquetaEstado estado={junta.estado} />
            {junta.acta_documento_id && (
              <span className="chip bg-exito-claro text-exito">
                <FileText className="size-3" aria-hidden />
                Acta
              </span>
            )}
            {administrador && (
              <BotonEliminar
                accion={eliminarJunta}
                id={junta.id}
                etiqueta="Eliminar"
                titulo="Eliminar junta"
                mensaje={`¿Eliminar la junta «${junta.titulo}»? Se borrarán también sus puntos del día y asistencias. El acta en PDF se conserva en Documentos.`}
              />
            )}
          </div>
        </div>

        {listaPuntos.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-principal">
              Puntos del día ({listaPuntos.length})
            </summary>
            <ol className="mt-2 space-y-1.5 pl-5 text-sm text-tinta/90" style={{ listStyle: "decimal" }}>
              {listaPuntos
                .slice()
                .sort((a, b) => a.posicion - b.posicion)
                .map((punto) => (
                  <li key={punto.id}>{punto.titulo}</li>
                ))}
            </ol>
          </details>
        )}

        <Link
          href={`/juntas/${junta.id}`}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-principal"
        >
          {administrador ? "Gestionar junta" : "Ver detalle"}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </li>
    );
  }

  return (
    <div>
      <CabeceraPagina
        titulo="Juntas"
        icono={Gavel}
        descripcion="Convocatorias, asistencia, acuerdos y actas"
        accion={
          administrador ? (
            <div className="flex flex-wrap gap-2">
              <Link href="/juntas/libro" className="boton boton-borde">
                <BookOpen className="size-4" aria-hidden />
                Libro de actas
              </Link>
              <NuevaJunta />
            </div>
          ) : undefined
        }
      />

      <section>
        <h2 className="sobretitulo mb-3">
          Próximas ({futuras.length})
        </h2>
        {futuras.length > 0 ? (
          <ul className="space-y-3">
            {futuras.map((junta) => (
              <Tarjeta key={junta.id} junta={junta} />
            ))}
          </ul>
        ) : (
          <EstadoVacio
            titulo="No hay juntas convocadas"
            descripcion="Cuando se convoque la próxima junta aparecerá aquí con su orden del día."
            accion={<Gavel className="size-9 text-principal/40" aria-hidden />}
          />
        )}
      </section>

      {pasadas.length > 0 && (
        <section className="mt-8">
          <h2 className="sobretitulo mb-3">
            Historial ({pasadas.length})
          </h2>
          <ul className="space-y-3">
            {pasadas.map((junta) => (
              <Tarjeta key={junta.id} junta={junta} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
