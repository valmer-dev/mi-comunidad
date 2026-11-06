import { Briefcase } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { CabeceraPagina, EstadoVacio } from "@/components/ui/CabeceraPagina";
import { NuevoServicio } from "./NuevoServicio";
import { ServicioItem } from "./ServicioItem";

export const metadata = { title: "Servicios" };

export default async function PaginaServicios() {
  const { comunidad, permisos } = await requerirContexto();
  const supabase = await crearClienteServidor();
  const puedeGestionar = esAdministrador(permisos);

  const { data: servicios } = await supabase
    .from("proveedores")
    .select("id, nombre, categoria, telefono")
    .eq("comunidad_id", comunidad.id)
    .order("categoria", { ascending: true, nullsFirst: false })
    .order("nombre", { ascending: true });

  const lista = servicios ?? [];

  return (
    <div>
      <CabeceraPagina
        titulo="Servicios"
        descripcion="Empresas contratadas por la comunidad y sus teléfonos de contacto"
        accion={puedeGestionar ? <NuevoServicio /> : undefined}
      />

      {lista.length > 0 ? (
        <ul className="space-y-3">
          {lista.map((servicio) => (
            <ServicioItem
              key={servicio.id}
              servicio={servicio}
              puedeGestionar={puedeGestionar}
            />
          ))}
        </ul>
      ) : (
        <EstadoVacio
          titulo="Todavía no hay servicios registrados"
          descripcion={
            puedeGestionar
              ? "Añade las empresas de mantenimiento, administración, limpieza y demás servicios contratados."
              : "La junta todavía no ha registrado las empresas de mantenimiento y administración."
          }
          accion={<Briefcase className="size-8 text-suave/50" aria-hidden />}
        />
      )}
    </div>
  );
}
