import { MapPin, UserRound, Wrench } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { puedeGestionarIncidencias } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFecha, formatoFechaCorta } from "@/lib/utilidades";
import { CabeceraPagina, EstadoVacio } from "@/components/ui/CabeceraPagina";
import { EtiquetaEstado } from "@/components/ui/EtiquetaEstado";
import { NuevaIncidencia } from "./NuevaIncidencia";
import { SelectorEstado } from "./SelectorEstado";

export const metadata = { title: "Incidencias" };

const ETIQUETAS_ESTADO: Record<string, string> = {
  abierta: "Abierta",
  en_curso: "En curso",
  resuelta: "Resuelta",
  cerrada: "Cerrada",
};

const ETIQUETAS_TIPO: Record<string, string> = {
  fontaneria: "Fontanería",
  electricidad: "Electricidad",
  ascensor: "Ascensor",
  limpieza: "Limpieza",
  obra: "Obra",
  ruido: "Ruido",
  zonas_comunes: "Zonas comunes",
  otro: "Otro",
};

export default async function PaginaIncidencias() {
  const { usuario, miembro, comunidad } = await requerirContexto();
  const supabase = await crearClienteServidor();
  const gestor = puedeGestionarIncidencias(miembro.rol);

  const { data: incidencias } = await supabase
    .from("incidencias")
    .select("id, titulo, descripcion, tipo, prioridad, estado, ubicacion, reportado_por, creado_en")
    .eq("comunidad_id", comunidad.id)
    .order("creado_en", { ascending: false });

  const abiertas = (incidencias ?? []).filter(
    (i) => i.estado === "abierta" || i.estado === "en_curso",
  );
  const cerradas = (incidencias ?? []).filter(
    (i) => i.estado === "resuelta" || i.estado === "cerrada",
  );

  // Seguimiento de cada incidencia: cambios de estado y comentarios.
  const { data: seguimientos } = await supabase
    .from("seguimientos_incidencia")
    .select("id, incidencia_id, autor_id, texto, estado_nuevo, creado_en")
    .in(
      "incidencia_id",
      (incidencias ?? []).map((i) => i.id),
    )
    .order("creado_en", { ascending: true });

  const seguimientosPorIncidencia = new Map<
    string,
    NonNullable<typeof seguimientos>
  >();
  for (const seguimiento of seguimientos ?? []) {
    const lista = seguimientosPorIncidencia.get(seguimiento.incidencia_id) ?? [];
    lista.push(seguimiento);
    seguimientosPorIncidencia.set(seguimiento.incidencia_id, lista);
  }

  // Personas que aparecen en la pagina: quien registro y quien hizo seguimiento.
  const idsPersonas = [
    ...new Set(
      [
        ...(incidencias ?? []).map((i) => i.reportado_por),
        ...(seguimientos ?? []).map((s) => s.autor_id),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: perfiles } = idsPersonas.length
    ? await supabase.from("perfiles").select("id, nombre, apellidos").in("id", idsPersonas)
    : { data: [] };

  const { data: miembros } = idsPersonas.length
    ? await supabase
        .from("miembros")
        .select("usuario_id, finca_principal_id")
        .eq("comunidad_id", comunidad.id)
        .in("usuario_id", idsPersonas)
    : { data: [] };

  const idsFincas = [
    ...new Set(
      (miembros ?? [])
        .map((m) => m.finca_principal_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: fincas } = idsFincas.length
    ? await supabase.from("fincas").select("id, codigo").in("id", idsFincas)
    : { data: [] };

  const mapaPerfiles = new Map((perfiles ?? []).map((p) => [p.id, p]));
  const mapaMiembros = new Map((miembros ?? []).map((m) => [m.usuario_id, m]));
  const mapaFincas = new Map((fincas ?? []).map((f) => [f.id, f.codigo]));

  function nombrePersona(id: string | null) {
    const perfil = id ? mapaPerfiles.get(id) : null;
    return (
      [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(" ") ||
      "un vecino de la comunidad"
    );
  }

  function reportador(id: string | null) {
    const miembroReportador = id ? mapaMiembros.get(id) : null;
    const finca = miembroReportador?.finca_principal_id
      ? mapaFincas.get(miembroReportador.finca_principal_id) ?? null
      : null;
    return { nombre: nombrePersona(id), finca };
  }

  function Tarjeta({ incidencia }: { incidencia: NonNullable<typeof incidencias>[number] }) {
    const quien = reportador(incidencia.reportado_por);
    const historial = seguimientosPorIncidencia.get(incidencia.id) ?? [];

    return (
      <li className="tarjeta">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-bold leading-snug">{incidencia.titulo}</h3>
            <p className="mt-0.5 text-xs text-suave">
              {ETIQUETAS_TIPO[incidencia.tipo] ?? incidencia.tipo} ·{" "}
              {formatoFecha(incidencia.creado_en)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <EtiquetaEstado estado={incidencia.prioridad} />
            {gestor ? (
              <SelectorEstado id={incidencia.id} estado={incidencia.estado} />
            ) : (
              <EtiquetaEstado estado={incidencia.estado} />
            )}
          </div>
        </div>

        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-tinta/90">
          {incidencia.descripcion}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-suave">
          <span className="flex items-center gap-1.5">
            <UserRound className="size-3.5" aria-hidden />
            {incidencia.reportado_por === usuario.id
              ? "La registraste tú"
              : `La registró ${quien.nombre}`}
            {quien.finca && (
              <span className="rounded-full bg-fondo px-2 py-0.5 font-medium text-tinta/80">
                {quien.finca}
              </span>
            )}
          </span>
          {incidencia.ubicacion && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden />
              {incidencia.ubicacion}
            </span>
          )}
        </div>

        {historial.length > 0 && (
          <div className="mt-3 rounded-xl bg-fondo/70 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-suave">
              Seguimiento
            </p>
            <ul className="mt-1 space-y-1.5 text-xs">
              {historial.map((seguimiento) => {
                const estadoNuevo = seguimiento.estado_nuevo
                  ? ETIQUETAS_ESTADO[seguimiento.estado_nuevo] ?? seguimiento.estado_nuevo
                  : null;
                return (
                  <li key={seguimiento.id}>
                    <p className="text-suave">
                      <span className="font-semibold text-tinta">
                        {nombrePersona(seguimiento.autor_id)}
                      </span>
                      {estadoNuevo && <> · {estadoNuevo}</>}
                      {" · "}
                      {formatoFechaCorta(seguimiento.creado_en)}
                    </p>
                    {seguimiento.texto && (
                      <p className="mt-0.5 whitespace-pre-line text-tinta/90">
                        {seguimiento.texto}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </li>
    );
  }

  return (
    <div>
      <CabeceraPagina
        titulo="Incidencias"
        descripcion="Averías y problemas del edificio"
        accion={<NuevaIncidencia />}
      />

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-suave">
          Abiertas ({abiertas.length})
        </h2>
        {abiertas.length > 0 ? (
          <ul className="space-y-3">
            {abiertas.map((incidencia) => (
              <Tarjeta key={incidencia.id} incidencia={incidencia} />
            ))}
          </ul>
        ) : (
          <EstadoVacio
            titulo="No hay incidencias abiertas"
            descripcion="Todo en orden. Si ves algo raro, regístralo aquí."
            accion={<Wrench className="size-8 text-suave/50" aria-hidden />}
          />
        )}
      </section>

      {cerradas.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-suave">
            Historial ({cerradas.length})
          </h2>
          <ul className="space-y-3">
            {cerradas.map((incidencia) => (
              <Tarjeta key={incidencia.id} incidencia={incidencia} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
