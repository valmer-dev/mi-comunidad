import Link from "next/link";
import {
  Bell,
  CheckCheck,
  FileText,
  Gavel,
  Megaphone,
  Receipt,
  Settings,
  Wrench,
} from "lucide-react";
import { abrirAviso, marcarAvisosLeidos } from "@/app/acciones/notificaciones";
import { requerirContexto } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { proveedorCorreo } from "@/lib/correo";
import { esCorreoInterno } from "@/lib/telefono";
import { cn, formatoFechaHora } from "@/lib/utilidades";
import { CabeceraPagina, EstadoVacio } from "@/components/ui/CabeceraPagina";

export const metadata = { title: "Notificaciones" };

const ICONOS: Record<string, typeof Bell> = {
  anuncio: Megaphone,
  convocatoria: Gavel,
  acta: FileText,
  recibo: Receipt,
  incidencia: Wrench,
};

export default async function PaginaNotificaciones() {
  const { usuario, perfil, comunidad } = await requerirContexto();
  const supabase = await crearClienteServidor();

  const { data: avisos } = await supabase
    .from("notificaciones")
    .select("id, tipo, titulo, cuerpo, leida_en, creado_en")
    .eq("usuario_id", usuario.id)
    .eq("comunidad_id", comunidad.id)
    .order("creado_en", { ascending: false })
    .limit(60);

  const sinLeer = (avisos ?? []).filter((aviso) => !aviso.leida_en).length;
  const correoActivo = proveedorCorreo() !== null;
  const sinCorreo =
    correoActivo && (!perfil?.correo || esCorreoInterno(perfil.correo));

  return (
    <div>
      <CabeceraPagina
        titulo="Notificaciones"
        icono={Bell}
        descripcion="Convocatorias, actas, recibos, avisos del tablón y tus incidencias"
        accion={
          sinLeer > 0 ? (
            <form action={marcarAvisosLeidos}>
              <button type="submit" className="boton boton-borde">
                <CheckCheck className="size-4" aria-hidden />
                Marcar todo como leído
              </button>
            </form>
          ) : undefined
        }
      />

      {sinCorreo && (
        <p className="mb-4 rounded-xl bg-acento-claro px-4 py-3 text-sm text-tinta">
          Si quieres recibir estos avisos también por correo, añade tu correo en{" "}
          <Link
            href="/ajustes#contacto"
            className="font-semibold text-principal underline-offset-2 hover:underline"
          >
            Ajustes
          </Link>
          .
        </p>
      )}

      {avisos && avisos.length > 0 ? (
        <ul className="space-y-2">
          {avisos.map((aviso) => {
            const Icono = ICONOS[aviso.tipo] ?? Bell;
            const nuevo = !aviso.leida_en;
            return (
              <li key={aviso.id}>
                <form action={abrirAviso}>
                  <input type="hidden" name="id" value={aviso.id} />
                  <button
                    type="submit"
                    className={cn(
                      "tarjeta flex w-full items-start gap-3 text-left transition-colors hover:border-principal/40",
                      nuevo && "border-principal/30 bg-principal/5",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-xl",
                        nuevo
                          ? "bg-principal text-white"
                          : "bg-hundido text-suave",
                      )}
                    >
                      <Icono className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-[15px] leading-snug",
                          nuevo ? "font-semibold" : "font-medium",
                        )}
                      >
                        {aviso.titulo}
                        {nuevo && <span className="sr-only"> (sin leer)</span>}
                      </span>
                      {aviso.cuerpo && (
                        <span className="mt-0.5 block text-sm text-suave">
                          {aviso.cuerpo}
                        </span>
                      )}
                      <span className="mt-1 block text-xs text-suave">
                        {formatoFechaHora(aviso.creado_en)}
                      </span>
                    </span>
                    {nuevo && (
                      <span
                        className="mt-1.5 size-2.5 shrink-0 rounded-full bg-principal"
                        aria-hidden
                      />
                    )}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <EstadoVacio
          titulo="No tienes notificaciones"
          descripcion="Aquí verás las convocatorias, las actas, tus recibos y los avisos del tablón."
          accion={<Bell className="size-9 text-principal/40" aria-hidden />}
        />
      )}

      {correoActivo && (
        <p className="mt-6 flex items-center gap-1.5 text-xs text-suave">
          <Settings className="size-3.5" aria-hidden />
          Puedes elegir si recibirlas por correo en{" "}
          <Link href="/ajustes#contacto" className="font-medium text-principal">
            Ajustes
          </Link>
          .
        </p>
      )}
    </div>
  );
}
