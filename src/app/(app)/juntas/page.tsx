import { CalendarDays, Gavel, MapPin } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFechaHora } from "@/lib/utilidades";
import { CabeceraPagina, EstadoVacio } from "@/components/ui/CabeceraPagina";
import { EtiquetaEstado } from "@/components/ui/EtiquetaEstado";
import { NuevaJunta } from "./NuevaJunta";

export const metadata = { title: "Juntas" };

export default async function PaginaJuntas() {
  const { comunidad, permisos } = await requerirContexto();
  const supabase = await crearClienteServidor();

  const { data: juntas } = await supabase
    .from("juntas")
    .select("id, titulo, tipo, fecha_hora, lugar, estado")
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

  const ahora = Date.now();
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
            <h3 className="text-base font-bold leading-snug">{junta.titulo}</h3>
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
            <span className="chip bg-slate-100 capitalize text-slate-600">{junta.tipo}</span>
            <EtiquetaEstado estado={junta.estado} />
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
      </li>
    );
  }

  return (
    <div>
      <CabeceraPagina
        titulo="Juntas"
        descripcion="Convocatorias, puntos del día y acuerdos"
        accion={esAdministrador(permisos) ? <NuevaJunta /> : undefined}
      />

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-suave">
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
            accion={<Gavel className="size-8 text-suave/50" aria-hidden />}
          />
        )}
      </section>

      {pasadas.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-suave">
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
