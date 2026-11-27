import { Building2, LogOut, RefreshCw, Settings, ShieldCheck, Smartphone, UserCircle } from "lucide-react";
import { cerrarSesion } from "@/app/acciones/autenticacion";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador, etiquetaRol, etiquetaRolPersona } from "@/lib/permisos";
import { esCorreoInterno, formatearTelefono } from "@/lib/telefono";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { CabeceraPagina } from "@/components/ui/CabeceraPagina";
import { InstalarApp } from "@/components/pwa/InstalarApp";
import { CambiarContrasena } from "./CambiarContrasena";
import { ComprobarActualizacion } from "./ComprobarActualizacion";
import { CoeficientesFincas } from "./CoeficientesFincas";
import { DatosContacto } from "./DatosContacto";
import { proveedorCorreo } from "@/lib/correo";
import { ConfigurarFincas } from "./ConfigurarFincas";
import { EditarComunidad } from "./EditarComunidad";

export const metadata = { title: "Ajustes" };

export default async function PaginaAjustes() {
  const { perfil, miembro, comunidad, esAdminPlataforma, permisos, roles } =
    await requerirContexto();
  const supabase = await crearClienteServidor();

  const puedeConfigurar = esAdminPlataforma || esAdministrador(permisos);

  const { data: fincas } = await supabase
    .from("fincas")
    .select("id, codigo, tipo, numero, coeficiente")
    .eq("comunidad_id", comunidad.id)
    .order("tipo")
    .order("numero")
    .order("codigo");

  const idsFincas = (fincas ?? []).map((finca) => finca.id);
  const { data: titulares } =
    puedeConfigurar && idsFincas.length
      ? await supabase
          .from("titulares")
          .select("finca_id, nombre, perfiles(nombre, apellidos)")
          .in("finca_id", idsFincas)
          .order("creado_en", { ascending: true })
      : { data: [] };

  const titularesPorFinca = new Map<string, string[]>();
  for (const titular of titulares ?? []) {
    const perfil = titular.perfiles;
    const nombre =
      titular.nombre?.trim() ||
      [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(" ") ||
      "Titular";
    const lista = titularesPorFinca.get(titular.finca_id) ?? [];
    lista.push(nombre);
    titularesPorFinca.set(titular.finca_id, lista);
  }

  return (
    <div>
      <CabeceraPagina titulo="Ajustes" icono={Settings} descripcion="Datos de la comunidad y de tu cuenta" />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="tarjeta">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Building2 className="size-4.5 text-principal" aria-hidden />
            La comunidad
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-suave">Nombre</dt>
              <dd className="text-right font-medium">{comunidad.nombre}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-suave">Dirección</dt>
              <dd className="text-right font-medium">
                {comunidad.direccion ?? "Sin definir"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-suave">Ciudad</dt>
              <dd className="text-right font-medium">
                {[comunidad.codigo_postal, comunidad.ciudad].filter(Boolean).join(" · ") ||
                  "Sin definir"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-suave">CIF</dt>
              <dd className="text-right font-medium">{comunidad.cif ?? "Sin definir"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-suave">Casas y pisos</dt>
              <dd className="text-right font-medium">
                {comunidad.numero_casas} casas · {comunidad.numero_pisos} pisos
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-suave">Administrador</dt>
              <dd className="text-right font-medium">
                {comunidad.administrador_nombre ?? "Sin definir"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 rounded-xl bg-hundido px-3.5 py-2.5 text-xs leading-relaxed text-suave">
            Estos datos aparecen en la cabecera y en los documentos de la comunidad.
          </p>
          {puedeConfigurar && (
            <EditarComunidad
              datos={{
                nombre: comunidad.nombre,
                direccion: comunidad.direccion,
                codigo_postal: comunidad.codigo_postal,
                ciudad: comunidad.ciudad,
                provincia: comunidad.provincia,
                cif: comunidad.cif,
                iban: comunidad.iban,
                administrador_nombre: comunidad.administrador_nombre,
                administrador_telefono: comunidad.administrador_telefono,
                administrador_correo: comunidad.administrador_correo,
              }}
            />
          )}
        </section>

        <section className="tarjeta">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <UserCircle className="size-4.5 text-principal" aria-hidden />
            Mi cuenta
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-suave">Nombre</dt>
              <dd className="text-right font-medium">
                {[perfil?.nombre, perfil?.apellidos].filter(Boolean).join(" ") || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-suave">Correo</dt>
              <dd className="text-right font-medium">
                {perfil?.correo && !esCorreoInterno(perfil.correo)
                  ? perfil.correo
                  : "No indicado"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-suave">Teléfono</dt>
              <dd className="text-right font-medium">
                {formatearTelefono(perfil?.telefono)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-suave">Rol</dt>
              <dd className="text-right font-medium">
                {etiquetaRolPersona(miembro.rol, esAdminPlataforma, roles)}
              </dd>
            </div>
            {esAdminPlataforma && (
              <div className="flex justify-between gap-4">
                <dt className="text-suave">Rol en la comunidad</dt>
                <dd className="text-right font-medium">
                  {etiquetaRol(miembro.rol, roles)}
                </dd>
              </div>
            )}
          </dl>

          <DatosContacto
            correo={perfil?.correo && !esCorreoInterno(perfil.correo) ? perfil.correo : ""}
            domicilio={perfil?.domicilio_notificaciones ?? ""}
            avisosCorreo={perfil?.avisos_correo ?? true}
            correoActivo={proveedorCorreo() !== null}
          />

          <form action={cerrarSesion} className="mt-5">
            <button type="submit" className="boton boton-borde w-full">
              <LogOut className="size-4" aria-hidden />
              Cerrar sesión
            </button>
          </form>

          <CambiarContrasena />
        </section>
      </div>

      {puedeConfigurar && (
        <div className="mt-5">
          <ConfigurarFincas
            numeroCasas={comunidad.numero_casas}
            numeroPisos={comunidad.numero_pisos}
            totalFincas={fincas?.length ?? 0}
          />
        </div>
      )}

      {puedeConfigurar && (
        <div className="mt-5">
          <CoeficientesFincas
            key={(fincas ?? []).map((finca) => `${finca.id}:${finca.coeficiente}`).join("|")}
            coeficienteTotal={Number(comunidad.coeficiente_total) || 100}
            fincas={(fincas ?? []).map((finca) => ({
              id: finca.id,
              codigo: finca.codigo,
              tipo: finca.tipo,
              coeficiente: Number(finca.coeficiente),
              titulares: titularesPorFinca.get(finca.id) ?? [],
            }))}
          />
        </div>
      )}

      <section className="tarjeta mt-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Smartphone className="size-4.5 text-principal" aria-hidden />
          Llévala en el móvil
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-suave">
          Instala Mi Comunidad como app: tendrás su icono en la pantalla de
          inicio, se abrirá a pantalla completa y se actualizará sola, sin pasar
          por la tienda.
        </p>
        <div className="mt-4">
          <InstalarApp />
        </div>
      </section>

      <section className="tarjeta mt-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <RefreshCw className="size-4.5 text-principal" aria-hidden />
          Actualizaciones
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-suave">
          La app busca cambios sola al abrirla. Si acabas de desplegar una
          versión nueva y no la ves, fuerza aquí la comprobación.
        </p>
        <div className="mt-4">
          <ComprobarActualizacion />
        </div>
      </section>

      <section className="tarjeta mt-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="size-4.5 text-principal" aria-hidden />
          Privacidad y datos
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-suave">
          Solo los miembros de la comunidad pueden acceder a la aplicación. Los datos
          económicos globales los consulta la junta directiva; solo el presidente y el
          administrador de plataforma pueden editarlos. Los datos se alojan en la Unión
          Europea.
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-suave">
          Para darte de baja o corregir tus datos, habla con el presidente o el
          secretario de la comunidad.
        </p>
      </section>
    </div>
  );
}
