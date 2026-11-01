import { Building2, LogOut, ShieldCheck, UserCircle } from "lucide-react";
import { cerrarSesion } from "@/app/acciones/autenticacion";
import { requerirContexto } from "@/lib/auth";
import { ETIQUETAS_ROL } from "@/lib/permisos";
import { CabeceraPagina } from "@/components/ui/CabeceraPagina";
import { CambiarContrasena } from "./CambiarContrasena";
import { EditarComunidad } from "./EditarComunidad";

export const metadata = { title: "Ajustes" };

export default async function PaginaAjustes() {
  const { perfil, miembro, comunidad } = await requerirContexto();

  return (
    <div>
      <CabeceraPagina titulo="Ajustes" descripcion="Datos de la comunidad y de tu cuenta" />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="tarjeta">
          <h2 className="flex items-center gap-2 text-base font-bold">
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
              <dt className="text-suave">Coeficiente total</dt>
              <dd className="text-right font-medium">
                {Number(comunidad.coeficiente_total).toFixed(2)} %
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-suave">Administrador</dt>
              <dd className="text-right font-medium">
                {comunidad.administrador_nombre ?? "Sin definir"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 rounded-xl bg-fondo px-3.5 py-2.5 text-xs leading-relaxed text-suave">
            Estos datos aparecen en la cabecera y en los documentos de la comunidad.
          </p>
          {miembro.rol === "presidente" && (
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
          <h2 className="flex items-center gap-2 text-base font-bold">
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
              <dd className="text-right font-medium">{perfil?.correo ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-suave">Teléfono</dt>
              <dd className="text-right font-medium">{perfil?.telefono ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-suave">Rol</dt>
              <dd className="text-right font-medium">{ETIQUETAS_ROL[miembro.rol]}</dd>
            </div>
          </dl>

          <form action={cerrarSesion} className="mt-5">
            <button type="submit" className="boton boton-borde w-full">
              <LogOut className="size-4" aria-hidden />
              Cerrar sesión
            </button>
          </form>

          <CambiarContrasena />
        </section>
      </div>

      <section className="tarjeta mt-5">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <ShieldCheck className="size-4.5 text-principal" aria-hidden />
          Privacidad y datos
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-suave">
          Solo los miembros de la comunidad pueden acceder a la aplicación. Cada vecino
          ve únicamente sus propios recibos; los datos económicos globales solo los
          consulta la junta directiva. Los datos se alojan en la Unión Europea.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-suave">
          Para darte de baja o corregir tus datos, habla con el presidente o el
          secretario de la comunidad.
        </p>
      </section>
    </div>
  );
}
