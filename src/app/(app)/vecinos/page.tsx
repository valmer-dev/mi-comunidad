import { Mail, Phone, Users } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador, ETIQUETAS_ROL } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { iniciales } from "@/lib/utilidades";
import { esCorreoInterno, formatearTelefono } from "@/lib/telefono";
import { CabeceraPagina, EstadoVacio } from "@/components/ui/CabeceraPagina";
import { EtiquetaEstado } from "@/components/ui/EtiquetaEstado";
import { NuevoVecino } from "./NuevoVecino";

export const metadata = { title: "Vecinos" };

export default async function PaginaVecinos() {
  const { miembro, comunidad, esAdminPlataforma } = await requerirContexto();
  const supabase = await crearClienteServidor();
  const admin = esAdminPlataforma || esAdministrador(miembro.rol);

  const [{ data: miembros }, { data: fincas }] = await Promise.all([
    supabase
      .from("miembros")
      .select("id, usuario_id, rol, estado, finca_principal_id, creado_en")
      .eq("comunidad_id", comunidad.id)
      .order("creado_en", { ascending: true }),
    supabase
      .from("fincas")
      .select("id, codigo, tipo, numero")
      .eq("comunidad_id", comunidad.id)
      .order("tipo")
      .order("numero"),
  ]);

  const idsFincas = (fincas ?? []).map((finca) => finca.id);
  const { data: titulares } = idsFincas.length
    ? await supabase
        .from("titulares")
        .select("id, finca_id, usuario_id, nombre, tipo")
        .in("finca_id", idsFincas)
        .order("creado_en", { ascending: true })
    : { data: [] };

  const idsPerfiles = [
    ...new Set([
      ...(miembros ?? []).map((m) => m.usuario_id),
      ...(titulares ?? []).map((t) => t.usuario_id).filter((id): id is string => Boolean(id)),
    ]),
  ];

  const { data: perfiles } = idsPerfiles.length
    ? await supabase
        .from("perfiles")
        .select("id, nombre, apellidos, correo, telefono")
        .in("id", idsPerfiles)
    : { data: [] };

  const mapaPerfiles = new Map((perfiles ?? []).map((p) => [p.id, p]));
  const mapaFincas = new Map((fincas ?? []).map((f) => [f.id, f]));

  function nombreTitular(titular: {
    nombre: string | null;
    usuario_id: string | null;
  }) {
    const perfil = titular.usuario_id ? mapaPerfiles.get(titular.usuario_id) : null;
    return (
      titular.nombre?.trim() ||
      [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(" ") ||
      "Titular"
    );
  }

  const titularesPorFinca = new Map<string, { nombre: string; tipo: string }[]>();
  for (const titular of titulares ?? []) {
    const lista = titularesPorFinca.get(titular.finca_id) ?? [];
    lista.push({ nombre: nombreTitular(titular), tipo: titular.tipo });
    titularesPorFinca.set(titular.finca_id, lista);
  }

  const sinTitular = (fincas ?? []).filter(
    (finca) => (titularesPorFinca.get(finca.id) ?? []).length === 0,
  ).length;

  return (
    <div>
      <CabeceraPagina
        titulo="Vecinos"
        descripcion={`${miembros?.length ?? 0} personas en la comunidad · ${
          fincas?.length ?? 0
        } casas y pisos`}
        accion={
          admin ? (
            <NuevoVecino
              fincas={(fincas ?? []).map((f) => ({ id: f.id, codigo: f.codigo, tipo: f.tipo }))}
              nombreComunidad={comunidad.nombre}
              urlApp={
                process.env.NEXT_PUBLIC_URL_APP ?? "https://comunidad-nine.vercel.app"
              }
            />
          ) : undefined
        }
      />

      {admin && sinTitular > 0 && (
        <p className="mb-4 rounded-xl bg-fondo px-4 py-3 text-sm text-suave">
          {sinTitular === 1
            ? "Hay 1 casa o piso sin titular asignado."
            : `Hay ${sinTitular} casas o pisos sin titular asignado.`}{" "}
          Asígnalos al añadir o editar un vecino.
        </p>
      )}

      {miembros && miembros.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {miembros.map((m) => {
            const perfil = mapaPerfiles.get(m.usuario_id);
            const finca = m.finca_principal_id ? mapaFincas.get(m.finca_principal_id) : null;
            const titularesFinca = finca ? titularesPorFinca.get(finca.id) ?? [] : [];
            const correoVisible =
              perfil?.correo && !esCorreoInterno(perfil.correo) ? perfil.correo : null;
            return (
              <li key={m.id} className="tarjeta flex items-start gap-4 p-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-principal-claro text-sm font-bold text-principal-oscuro">
                  {iniciales(perfil?.nombre, perfil?.apellidos)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold leading-tight">
                      {perfil?.nombre} {perfil?.apellidos ?? ""}
                    </p>
                    <EtiquetaEstado estado={m.estado} />
                  </div>
                  <p className="mt-0.5 text-sm text-suave">
                    {ETIQUETAS_ROL[m.rol]}
                    {finca ? ` · ${finca.codigo}` : ""}
                  </p>
                  {titularesFinca.length > 1 && (
                    <p className="mt-1 text-xs text-suave">
                      Titulares: {titularesFinca.map((t) => t.nombre).join(" y ")}
                    </p>
                  )}
                  <div className="mt-2 flex flex-col gap-1 text-sm text-suave">
                    {correoVisible && (
                      <a
                        href={`mailto:${correoVisible}`}
                        className="flex items-center gap-1.5 hover:text-principal"
                      >
                        <Mail className="size-3.5" aria-hidden />
                        <span className="truncate">{correoVisible}</span>
                      </a>
                    )}
                    {perfil?.telefono && (
                      <a
                        href={`tel:${perfil.telefono}`}
                        className="flex items-center gap-1.5 hover:text-principal"
                      >
                        <Phone className="size-3.5" aria-hidden />
                        {formatearTelefono(perfil.telefono)}
                      </a>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EstadoVacio
          titulo="Todavía no hay vecinos"
          descripcion="Añade al primer vecino para empezar a organizar la comunidad."
        />
      )}

      {(fincas ?? []).length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
            <Users className="size-4.5 text-principal" aria-hidden />
            Casas y pisos ({fincas?.length})
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-borde bg-superficie">
            <table className="w-full text-sm">
              <thead className="bg-fondo text-left text-xs uppercase tracking-wide text-suave">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Finca</th>
                  <th className="px-4 py-2.5 font-semibold">Titulares</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {fincas?.map((finca) => {
                  const titularesFinca = titularesPorFinca.get(finca.id) ?? [];
                  return (
                    <tr key={finca.id}>
                      <td className="px-4 py-2.5 font-medium">{finca.codigo}</td>
                      <td className="px-4 py-2.5 text-suave">
                        {titularesFinca.length > 0
                          ? titularesFinca.map((t) => t.nombre).join(" y ")
                          : "Sin titular"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
