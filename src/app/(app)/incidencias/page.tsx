import { MapPin, UserRound, Wrench } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFecha } from "@/lib/utilidades";
import { CabeceraPagina, EstadoVacio } from "@/components/ui/CabeceraPagina";
import { EtiquetaEstado } from "@/components/ui/EtiquetaEstado";
import { NuevaIncidencia } from "./NuevaIncidencia";
import { SelectorEstado } from "./SelectorEstado";

export const metadata = { title: "Incidencias" };

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
  const admin = esAdministrador(miembro.rol);

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

  // Quien registro cada incidencia: nombre y vivienda.
  const idsReportadores = [
    ...new Set(
      (incidencias ?? [])
        .map((i) => i.reportado_por)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: perfilesReportadores } = idsReportadores.length
    ? await supabase
        .from("perfiles")
        .select("id, nombre, apellidos")
        .in("id", idsReportadores)
    : { data: [] };

  const { data: miembrosReportadores } = idsReportadores.length
    ? await supabase
        .from("miembros")
        .select("usuario_id, finca_principal_id")
        .eq("comunidad_id", comunidad.id)
        .in("usuario_id", idsReportadores)
    : { data: [] };

  const idsFincasReportadores = [
    ...new Set(
      (miembrosReportadores ?? [])
        .map((m) => m.finca_principal_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: fincasReportadores } = idsFincasReportadores.length
    ? await supabase.from("fincas").select("id, codigo").in("id", idsFincasReportadores)
    : { data: [] };

  const mapaPerfiles = new Map(
    (perfilesReportadores ?? []).map((p) => [p.id, p]),
  );
  const mapaMiembros = new Map(
    (miembrosReportadores ?? []).map((m) => [m.usuario_id, m]),
  );
  const mapaFincas = new Map(
    (fincasReportadores ?? []).map((f) => [f.id, f.codigo]),
  );

  function reportador(id: string | null) {
    const perfil = id ? mapaPerfiles.get(id) : null;
    const nombre =
      [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(" ") ||
      "un vecino de la comunidad";
    const miembroReportador = id ? mapaMiembros.get(id) : null;
    const finca = miembroReportador?.finca_principal_id
      ? mapaFincas.get(miembroReportador.finca_principal_id) ?? null
      : null;
    return { nombre, finca };
  }

  function puedeEditar(reportadoPor: string | null) {
    return admin || reportadoPor === usuario.id;
  }

  function Tarjeta({ incidencia }: { incidencia: NonNullable<typeof incidencias>[number] }) {
    const quien = reportador(incidencia.reportado_por);

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
            {puedeEditar(incidencia.reportado_por) ? (
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
