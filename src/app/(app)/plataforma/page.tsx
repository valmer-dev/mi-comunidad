import { redirect } from "next/navigation";
import {
  Building2,
  Home,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import { abrirComunidad } from "@/app/acciones/plataforma";
import { obtenerContexto } from "@/lib/auth";
import { esCorreoInterno } from "@/lib/telefono";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { CabeceraPagina } from "@/components/ui/CabeceraPagina";
import { NuevaComunidad } from "./NuevaComunidad";
import { TablaRoles } from "./TablaRoles";
import { TablaVecinos, type VecinoPlataforma } from "./TablaVecinos";

export const metadata = { title: "Plataforma" };

type TitularFila = {
  id: string;
  finca_id: string;
  usuario_id: string | null;
  nombre: string | null;
};

export default async function PaginaPlataforma() {
  const { usuario, esAdminPlataforma, miembro, comunidad, roles } =
    await obtenerContexto();

  if (!esAdminPlataforma) redirect(miembro ? "/panel" : "/sin-acceso");

  const supabase = await crearClienteServidor();

  const [{ data: comunidades }, { data: fincas }, { data: miembros }] =
    await Promise.all([
      supabase
        .from("comunidades")
        .select("id, nombre, direccion, ciudad, numero_casas, numero_pisos, creado_en")
        .order("creado_en", { ascending: true }),
      supabase.from("fincas").select("id, comunidad_id"),
      supabase.from("miembros").select("comunidad_id, usuario_id, estado").eq("estado", "activo"),
    ]);

  const fincasPorComunidad = new Map<string, number>();
  for (const finca of fincas ?? []) {
    fincasPorComunidad.set(
      finca.comunidad_id,
      (fincasPorComunidad.get(finca.comunidad_id) ?? 0) + 1,
    );
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

  let fincasComunidad: { id: string; codigo: string; tipo: string }[] = [];
  let vecinos: VecinoPlataforma[] = [];

  if (comunidad) {
    const [{ data: fincasActivas }, { data: miembrosActivos }] = await Promise.all([
      supabase
        .from("fincas")
        .select("id, codigo, tipo")
        .eq("comunidad_id", comunidad.id)
        .order("tipo")
        .order("numero"),
      supabase
        .from("miembros")
        .select("id, usuario_id, rol, estado, finca_principal_id")
        .eq("comunidad_id", comunidad.id)
        .order("creado_en", { ascending: true }),
    ]);

    fincasComunidad = fincasActivas ?? [];

    const idsFincasActivas = (fincasActivas ?? []).map((finca) => finca.id);
    const { data: titulares } = idsFincasActivas.length
      ? await supabase
          .from("titulares")
          .select("id, finca_id, usuario_id, nombre")
          .in("finca_id", idsFincasActivas)
          .order("creado_en", { ascending: true })
      : { data: [] };

    const idsPerfiles = [
      ...new Set([
        ...(miembrosActivos ?? []).map((fila) => fila.usuario_id),
        ...(titulares ?? [])
          .map((titular) => titular.usuario_id)
          .filter((id): id is string => Boolean(id)),
      ]),
    ];

    const { data: perfiles } = idsPerfiles.length
      ? await supabase
          .from("perfiles")
          .select(
            "id, nombre, apellidos, correo, telefono, es_admin_plataforma",
          )
          .in("id", idsPerfiles)
      : { data: [] };

    const mapaPerfiles = new Map((perfiles ?? []).map((perfil) => [perfil.id, perfil]));
    const mapaFincas = new Map(
      (fincasActivas ?? []).map((finca) => [finca.id, finca]),
    );

    const titularesPorFinca = new Map<string, TitularFila[]>();
    for (const titular of titulares ?? []) {
      const lista = titularesPorFinca.get(titular.finca_id) ?? [];
      lista.push(titular);
      titularesPorFinca.set(titular.finca_id, lista);
    }

    vecinos = (miembrosActivos ?? []).map((fila) => {
      const perfil = mapaPerfiles.get(fila.usuario_id);
      const finca = fila.finca_principal_id
        ? mapaFincas.get(fila.finca_principal_id)
        : null;

      const nombreMiembro = [perfil?.nombre, perfil?.apellidos]
        .filter(Boolean)
        .join(" ")
        .trim()
        .toLowerCase();

      const titularesFinca = fila.finca_principal_id
        ? titularesPorFinca.get(fila.finca_principal_id) ?? []
        : [];

      // El otro titular de la vivienda: una persona distinta con o sin cuenta.
      const otroTitular =
        titularesFinca.find(
          (titular) =>
            titular.usuario_id && titular.usuario_id !== fila.usuario_id,
        ) ??
        titularesFinca.find(
          (titular) =>
            !titular.usuario_id &&
            Boolean(titular.nombre?.trim()) &&
            titular.nombre!.trim().toLowerCase() !== nombreMiembro,
        ) ??
        null;

      const perfilCotitular = otroTitular?.usuario_id
        ? mapaPerfiles.get(otroTitular.usuario_id)
        : null;
      const correoCotitular =
        perfilCotitular?.correo && !esCorreoInterno(perfilCotitular.correo)
          ? perfilCotitular.correo
          : null;

      return {
        miembroId: fila.id,
        usuarioId: fila.usuario_id,
        nombre: perfil?.nombre ?? "Sin nombre",
        apellidos: perfil?.apellidos ?? null,
        correo: perfil?.correo ?? null,
        telefono: perfil?.telefono ?? null,
        rol: fila.rol,
        estado: fila.estado,
        fincaId: fila.finca_principal_id,
        fincaCodigo: finca?.codigo ?? null,
        esAdminPlataforma: Boolean(perfil?.es_admin_plataforma),
        cotitular: otroTitular
          ? {
              titularId: otroTitular.id,
              usuarioId: otroTitular.usuario_id,
              nombre:
                [perfilCotitular?.nombre, perfilCotitular?.apellidos]
                  .filter(Boolean)
                  .join(" ") ||
                otroTitular.nombre ||
                "Titular",
              telefono: perfilCotitular?.telefono ?? null,
              correo: correoCotitular,
            }
          : null,
      };
    });
  }

  return (
    <div>
      <CabeceraPagina
        titulo="Plataforma"
        descripcion="Todas las comunidades, roles y gestión de vecinos"
      />

      <p className="mb-5 flex items-start gap-2 rounded-xl bg-principal-claro/60 px-4 py-3 text-sm text-principal-oscuro">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        Eres administrador de la plataforma: puedes crear comunidades, editar los
        roles y gestionar los vecinos de la comunidad activa.
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

      <section className="mt-8">
        <h2 className="mb-1 flex items-center gap-2 text-base font-bold">
          <ShieldCheck className="size-4.5 text-principal" aria-hidden />
          Roles y permisos
        </h2>
        <p className="mb-3 text-sm text-suave">
          Edita el nombre, la descripción y los permisos de cada rol. Los cambios se
          aplican a toda la aplicación.
        </p>
        <TablaRoles roles={roles} />
      </section>

      <section className="mt-8">
        {comunidad ? (
          <TablaVecinos
            vecinos={vecinos}
            fincas={fincasComunidad}
            roles={roles}
            nombreComunidad={comunidad.nombre}
            urlApp={
              process.env.NEXT_PUBLIC_URL_APP ?? "https://mi-comunidad-one.vercel.app"
            }
          />
        ) : (
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
              <Users className="size-4.5 text-principal" aria-hidden />
              Vecinos
            </h2>
            <p className="rounded-2xl border border-borde bg-superficie px-4 py-8 text-center text-sm text-suave">
              Entra en una comunidad para gestionar sus vecinos.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
