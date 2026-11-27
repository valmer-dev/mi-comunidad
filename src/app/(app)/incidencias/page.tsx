import { HardHat, MapPin, ShieldCheck, UserRound, Wallet, Wrench } from "lucide-react";
import { eliminarIncidencia } from "@/app/acciones/incidencias";
import { requerirContexto } from "@/lib/auth";
import { ESTADOS_SEGURO, type EstadoSeguro } from "@/lib/incidencias";
import { esAdministrador, puedeEditarFinanzas, puedeGestionarIncidencias, puedeVerFinanzas } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFecha, formatoFechaCorta } from "@/lib/utilidades";
import { BotonEliminar } from "@/components/ui/BotonEliminar";
import { CabeceraPagina, EstadoVacio } from "@/components/ui/CabeceraPagina";
import { EtiquetaEstado } from "@/components/ui/EtiquetaEstado";
import { FotosIncidencia, type Foto } from "./FotosIncidencia";
import { GestionIncidencia } from "./GestionIncidencia";
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
  const { usuario, comunidad, permisos, miembro, esAdminPlataforma } = await requerirContexto();
  const supabase = await crearClienteServidor();
  const gestor = puedeGestionarIncidencias(permisos);
  const administrador = esAdministrador(permisos);
  const editaFinanzas = puedeEditarFinanzas(miembro.rol, esAdminPlataforma);
  const verCostes = gestor || puedeVerFinanzas(permisos);

  const [{ data: incidencias }, { data: proveedores }, { data: todasFincas }] = await Promise.all([
    supabase
      .from("incidencias")
      .select(
        "id, titulo, descripcion, tipo, prioridad, estado, ubicacion, reportado_por, creado_en, proveedor_id, coste, responsable, finca_id, gasto_id, seguro_parte, seguro_comunicado_en, seguro_estado, seguro_indemnizacion",
      )
      .eq("comunidad_id", comunidad.id)
      .order("creado_en", { ascending: false }),
    supabase
      .from("proveedores")
      .select("id, nombre, categoria, telefono")
      .eq("comunidad_id", comunidad.id)
      .order("nombre"),
    supabase
      .from("fincas")
      .select("id, codigo")
      .eq("comunidad_id", comunidad.id)
      .order("tipo")
      .order("numero"),
  ]);

  const mapaProveedores = new Map((proveedores ?? []).map((p) => [p.id, p]));
  const codigoFinca = new Map((todasFincas ?? []).map((f) => [f.id, f.codigo]));
  const aseguradora = (proveedores ?? []).find((p) => /seguro/i.test(p.categoria ?? ""));

  // Fotos de cada incidencia, con enlaces firmados de una hora.
  const { data: filasFotos } = (incidencias ?? []).length
    ? await supabase
        .from("incidencias_fotos")
        .select("id, incidencia_id, ruta, subido_por")
        .in("incidencia_id", (incidencias ?? []).map((i) => i.id))
        .order("creado_en")
    : { data: [] };
  const { data: firmadas } = (filasFotos ?? []).length
    ? await supabase.storage.from("incidencias").createSignedUrls((filasFotos ?? []).map((f) => f.ruta), 60 * 60)
    : { data: [] };
  const fotosPorIncidencia = new Map<string, Foto[]>();
  (filasFotos ?? []).forEach((foto, indice) => {
    const url = firmadas?.[indice]?.signedUrl;
    if (!url) return;
    fotosPorIncidencia.set(foto.incidencia_id, [
      ...(fotosPorIncidencia.get(foto.incidencia_id) ?? []),
      { id: foto.id, url, puedeBorrar: gestor || foto.subido_por === usuario.id },
    ]);
  });

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
      <li id={`incidencia-${incidencia.id}`} className="tarjeta scroll-mt-24">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[17px] font-semibold leading-snug">{incidencia.titulo}</h3>
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
            {administrador && (
              <BotonEliminar
                accion={eliminarIncidencia}
                id={incidencia.id}
                etiqueta="Eliminar"
                titulo="Eliminar incidencia"
                mensaje={`¿Eliminar la incidencia «${incidencia.titulo}» y todo su seguimiento? Esta acción no se puede deshacer.`}
              />
            )}
          </div>
        </div>

        <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-tinta/90">
          {incidencia.descripcion}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-suave">
          <span className="flex items-center gap-1.5">
            <UserRound className="size-3.5" aria-hidden />
            {incidencia.reportado_por === usuario.id
              ? "La registraste tú"
              : `La registró ${quien.nombre}`}
            {quien.finca && (
              <span className="rounded-full bg-hundido px-2 py-0.5 font-medium text-tinta/80">
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

        {(incidencia.proveedor_id || incidencia.responsable !== "comunidad" || incidencia.seguro_estado || (verCostes && incidencia.coste != null)) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            {incidencia.proveedor_id && mapaProveedores.has(incidencia.proveedor_id) && (
              <span className="flex items-center gap-1.5">
                <HardHat className="size-3.5 text-suave" aria-hidden />
                Lo arregla {mapaProveedores.get(incidencia.proveedor_id)!.nombre}
              </span>
            )}
            {incidencia.responsable === "privativo" && (
              <span className="flex items-center gap-1.5">
                <Wallet className="size-3.5 text-suave" aria-hidden />
                Privativo: lo paga {incidencia.finca_id ? codigoFinca.get(incidencia.finca_id) ?? "la vivienda" : "la vivienda"}
              </span>
            )}
            {incidencia.responsable === "por_determinar" && (
              <span className="flex items-center gap-1.5">
                <Wallet className="size-3.5 text-suave" aria-hidden />
                Falta saber quién lo paga
              </span>
            )}
            {verCostes && incidencia.coste != null && (
              <span className="tabular-nums">
                Coste {Number(incidencia.coste).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                {incidencia.gasto_id && " · apuntado en gastos"}
              </span>
            )}
            {incidencia.seguro_estado && (
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-suave" aria-hidden />
                Seguro: {ESTADOS_SEGURO[incidencia.seguro_estado as EstadoSeguro] ?? incidencia.seguro_estado}
                {incidencia.seguro_parte && ` (parte ${incidencia.seguro_parte})`}
                {verCostes && incidencia.seguro_indemnizacion != null &&
                  ` · ${Number(incidencia.seguro_indemnizacion).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}`}
              </span>
            )}
          </div>
        )}

        <FotosIncidencia
          comunidadId={comunidad.id}
          incidenciaId={incidencia.id}
          fotos={fotosPorIncidencia.get(incidencia.id) ?? []}
          puedeAnadir={gestor || incidencia.reportado_por === usuario.id}
        />

        {gestor && (
          <GestionIncidencia
            incidencia={{
              id: incidencia.id,
              proveedor_id: incidencia.proveedor_id,
              coste: incidencia.coste == null ? null : Number(incidencia.coste),
              responsable: incidencia.responsable,
              finca_id: incidencia.finca_id,
              gasto_id: incidencia.gasto_id,
              seguro_parte: incidencia.seguro_parte,
              seguro_comunicado_en: incidencia.seguro_comunicado_en,
              seguro_estado: incidencia.seguro_estado,
              seguro_indemnizacion: incidencia.seguro_indemnizacion == null ? null : Number(incidencia.seguro_indemnizacion),
            }}
            proveedores={(proveedores ?? []).map((p) => ({
              id: p.id,
              nombre: p.categoria ? `${p.nombre} (${p.categoria})` : p.nombre,
            }))}
            fincas={(todasFincas ?? []).map((f) => ({ id: f.id, nombre: f.codigo }))}
            editaFinanzas={editaFinanzas}
            seguro={aseguradora ? { nombre: aseguradora.nombre, telefono: aseguradora.telefono } : null}
          />
        )}

        {historial.length > 0 && (
          <div className="mt-3 rounded-xl bg-hundido/70 px-3 py-2">
            <p className="sobretitulo">
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
        icono={Wrench}
        descripcion="Averías y problemas del edificio"
        accion={<NuevaIncidencia comunidadId={comunidad.id} />}
      />

      <section>
        <h2 className="sobretitulo mb-3">
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
            accion={<Wrench className="size-9 text-principal/40" aria-hidden />}
          />
        )}
      </section>

      {cerradas.length > 0 && (
        <section className="mt-8">
          <h2 className="sobretitulo mb-3">
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
