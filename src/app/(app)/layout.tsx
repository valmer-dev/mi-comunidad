import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { obtenerContexto } from "@/lib/auth";
import {
  esAdministrador,
  etiquetaRolPersona,
  puedeVerFinanzas,
} from "@/lib/permisos";
import { Estructura } from "@/components/estructura/Estructura";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { iniciales } from "@/lib/utilidades";

export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const { usuario, perfil, miembro, comunidad, esAdminPlataforma, permisos, roles } =
    await obtenerContexto();
  const nombre = perfil?.nombre?.trim() || "Vecino";

  // Un administrador de plataforma puede no pertenecer a ninguna comunidad:
  // aun asi entra a /plataforma para crear la primera.
  if (!miembro || !comunidad) {
    if (!esAdminPlataforma) redirect("/sin-acceso");

    return (
      <div className="min-h-dvh">
        <header
          className="no-imprimir border-b border-borde bg-superficie px-4 py-3"
          style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
        >
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
            <Link href="/plataforma" className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-marca to-marca-oscuro text-white">
                <Building2 className="size-4.5" aria-hidden />
              </span>
              <span className="text-sm font-bold">Mi Comunidad · Plataforma</span>
            </Link>
            <span className="grid size-9 place-items-center rounded-full bg-principal-claro text-xs font-bold text-principal-oscuro">
              {iniciales(nombre)}
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-10">
          {children}
        </main>
      </div>
    );
  }

  const supabase = await crearClienteServidor();
  const { count: sinLeer } = await supabase
    .from("notificaciones")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", usuario.id)
    .eq("comunidad_id", comunidad.id)
    .is("leida_en", null);

  return (
    <Estructura
      notificacionesSinLeer={sinLeer ?? 0}
      nombreComunidad={comunidad.nombre}
      nombreUsuario={nombre}
      etiquetaRol={etiquetaRolPersona(
        miembro.rol,
        esAdminPlataforma,
        roles,
      )}
      esAdmin={esAdministrador(permisos)}
      puedeVerFinanzas={puedeVerFinanzas(permisos)}
      esAdminPlataforma={esAdminPlataforma}
    >
      {children}
    </Estructura>
  );
}
