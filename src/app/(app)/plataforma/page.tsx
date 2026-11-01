import { redirect } from "next/navigation";
import { Building2, Home, MapPin, ShieldCheck, Users } from "lucide-react";
import { abrirComunidad } from "@/app/acciones/plataforma";
import { obtenerContexto } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { CabeceraPagina } from "@/components/ui/CabeceraPagina";
import { NuevaComunidad } from "./NuevaComunidad";

export const metadata = { title: "Plataforma" };

export default async function PaginaPlataforma() {
  const { usuario, esAdminPlataforma, miembro, comunidad } = await obtenerContexto();

  if (!esAdminPlataforma) redirect(miembro ? "/panel" : "/sin-acceso");

  const supabase = await crearClienteServidor();

  const [{ data: comunidades }, { data: fincas }, { data: miembros }] = await Promise.all([
    supabase
      .from("comunidades")
      .select("id, nombre, direccion, ciudad, numero_casas, numero_pisos, creado_en")
      .order("creado_en", { ascending: true }),
    supabase.from("fincas").select("id, comunidad_id"),
    supabase.from("miembros").select("comunidad_id, usuario_id, estado").eq("estado", "activo"),
  ]);

  const fincasPorComunidad = new Map<string, number>();
  for (const finca of fincas ?? []) {
    fincasPorComunidad.set(finca.comunidad_id, (fincasPorComunidad.get(finca.comunidad_id) ?? 0) + 1);
  }

  const miembrosPorComunidad = new Map<string, number>();
  const misComunidades = new Set<string>();
  for (const fila of miembros ?? []) {
    miembrosPorComunidad.set(
      fila.comunidad_id,
      (miembrosPorComunidad.get(fila.comunidad_id) ?? 0) + 1,
    );
    if (fila.usuario_id === usuario.id) misComunidades.add(fila.comunidad_id);
  }

  return (
    <div>
      <CabeceraPagina
        titulo="Plataforma"
        descripcion="Todas las comunidades y creación de nuevas comunidades"
      />

      <p className="mb-5 flex items-start gap-2 rounded-xl bg-principal-claro/60 px-4 py-3 text-sm text-principal-oscuro">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        Eres administrador de la plataforma: puedes crear comunidades y entrar en
        cualquier comunidad en la que participes.
      </p>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
            <Building2 className="size-4.5 text-principal" aria-hidden />
            Comunidades ({comunidades?.length ?? 0})
          </h2>

          <ul className="grid gap-3">
            {(comunidades ?? []).map((fila) => {
              const esActual = fila.id === comunidad?.id;
              const soyMiembro = misComunidades.has(fila.id);
              return (
                <li key={fila.id} className="tarjeta p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">{fila.nombre}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-suave">
                        <MapPin className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">
                          {[fila.direccion, fila.ciudad].filter(Boolean).join(", ") ||
                            "Sin dirección"}
                        </span>
                      </p>
                    </div>
                    {esActual && (
                      <span className="chip bg-emerald-100 text-emerald-800">En uso</span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-suave">
                    <span className="flex items-center gap-1.5">
                      <Home className="size-3.5" aria-hidden />
                      {fila.numero_casas} casas · {fila.numero_pisos} pisos
                      <span className="text-xs">
                        ({fincasPorComunidad.get(fila.id) ?? 0} fincas)
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5" aria-hidden />
                      {miembrosPorComunidad.get(fila.id) ?? 0} vecinos
                    </span>
                  </div>

                  <div className="mt-3">
                    {soyMiembro ? (
                      <form action={abrirComunidad}>
                        <input type="hidden" name="comunidadId" value={fila.id} />
                        <button
                          type="submit"
                          className="boton boton-borde"
                          disabled={esActual}
                        >
                          {esActual ? "Estás dentro" : "Entrar en esta comunidad"}
                        </button>
                      </form>
                    ) : (
                      <p className="text-xs text-suave">
                        No participas en esta comunidad.
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
            <Building2 className="size-4.5 text-principal" aria-hidden />
            Nueva comunidad
          </h2>
          <NuevaComunidad />
        </section>
      </div>
    </div>
  );
}
