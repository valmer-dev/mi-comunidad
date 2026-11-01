import { Mail, Phone, Users } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador, ETIQUETAS_ROL } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { iniciales } from "@/lib/utilidades";
import { CabeceraPagina, EstadoVacio } from "@/components/ui/CabeceraPagina";
import { EtiquetaEstado } from "@/components/ui/EtiquetaEstado";
import { NuevoVecino } from "./NuevoVecino";

export const metadata = { title: "Vecinos" };

export default async function PaginaVecinos() {
  const { miembro, comunidad } = await requerirContexto();
  const supabase = await crearClienteServidor();
  const admin = esAdministrador(miembro.rol);

  const [{ data: miembros }, { data: fincas }] = await Promise.all([
    supabase
      .from("miembros")
      .select("id, usuario_id, rol, estado, finca_principal_id, creado_en")
      .eq("comunidad_id", comunidad.id)
      .order("creado_en", { ascending: true }),
    supabase
      .from("fincas")
      .select("id, codigo, tipo, coeficiente")
      .eq("comunidad_id", comunidad.id)
      .order("codigo"),
  ]);

  const ids = (miembros ?? []).map((m) => m.usuario_id);
  const { data: perfiles } = ids.length
    ? await supabase
        .from("perfiles")
        .select("id, nombre, apellidos, correo, telefono")
        .in("id", ids)
    : { data: [] };

  const mapaPerfiles = new Map((perfiles ?? []).map((p) => [p.id, p]));
  const mapaFincas = new Map((fincas ?? []).map((f) => [f.id, f]));
  const coeficienteTotal = (fincas ?? []).reduce(
    (total, finca) => total + Number(finca.coeficiente ?? 0),
    0,
  );

  return (
    <div>
      <CabeceraPagina
        titulo="Vecinos"
        descripcion={`${miembros?.length ?? 0} personas en la comunidad`}
        accion={
          admin ? (
            <NuevoVecino
              fincas={(fincas ?? []).map((f) => ({ id: f.id, codigo: f.codigo, tipo: f.tipo }))}
            />
          ) : undefined
        }
      />

      {admin && (fincas ?? []).length > 0 && coeficienteTotal !== 100 && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Los coeficientes de las fincas suman <strong>{coeficienteTotal.toFixed(2)} %</strong> y
          deberían sumar 100 %. Revísalos en Ajustes.
        </p>
      )}

      {miembros && miembros.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {miembros.map((m) => {
            const perfil = mapaPerfiles.get(m.usuario_id);
            const finca = m.finca_principal_id ? mapaFincas.get(m.finca_principal_id) : null;
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
                  <div className="mt-2 flex flex-col gap-1 text-sm text-suave">
                    {perfil?.correo && (
                      <a
                        href={`mailto:${perfil.correo}`}
                        className="flex items-center gap-1.5 hover:text-principal"
                      >
                        <Mail className="size-3.5" aria-hidden />
                        <span className="truncate">{perfil.correo}</span>
                      </a>
                    )}
                    {perfil?.telefono && (
                      <a
                        href={`tel:${perfil.telefono}`}
                        className="flex items-center gap-1.5 hover:text-principal"
                      >
                        <Phone className="size-3.5" aria-hidden />
                        {perfil.telefono}
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
            Fincas ({fincas?.length})
          </h2>
          <div className="overflow-hidden rounded-2xl border border-borde bg-superficie">
            <table className="w-full text-sm">
              <thead className="bg-fondo text-left text-xs uppercase tracking-wide text-suave">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Código</th>
                  <th className="px-4 py-2.5 font-semibold">Tipo</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Coeficiente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {fincas?.map((finca) => (
                  <tr key={finca.id}>
                    <td className="px-4 py-2.5 font-medium">{finca.codigo}</td>
                    <td className="px-4 py-2.5 capitalize text-suave">{finca.tipo}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {Number(finca.coeficiente).toFixed(2)} %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
