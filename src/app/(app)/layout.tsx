import { requerirContexto } from "@/lib/auth";
import { esAdministrador, puedeVerFinanzas } from "@/lib/permisos";
import { Estructura } from "@/components/estructura/Estructura";

export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const { perfil, miembro, comunidad } = await requerirContexto();
  const nombre = perfil?.nombre?.trim() || "Vecino";

  return (
    <Estructura
      nombreComunidad={comunidad.nombre}
      nombreUsuario={nombre}
      rol={miembro.rol}
      esAdmin={esAdministrador(miembro.rol)}
      puedeVerFinanzas={puedeVerFinanzas(miembro.rol)}
    >
      {children}
    </Estructura>
  );
}
