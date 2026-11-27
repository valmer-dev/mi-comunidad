import Link from "next/link";
import { notFound } from "next/navigation";
import { Home } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { formatoCoeficiente } from "@/lib/coeficientes";
import { esAdministrador, puedeEditarFinanzas } from "@/lib/permisos";
import { hoyISO, nombrePeriodo, resumirRecibos } from "@/lib/recibos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoMoneda } from "@/lib/utilidades";
import { CabeceraPagina } from "@/components/ui/CabeceraPagina";
import { cargarFincas, COLUMNAS_RECIBO, normalizarRecibos } from "../datos";
import { ListaRecibos } from "../ListaRecibos";

export const metadata = { title: "Estado de cuentas" };

export default async function PaginaCuentaVivienda(props: PageProps<"/finanzas/recibos/[fincaId]">) {
  const { fincaId } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(fincaId)) notFound();

  const { comunidad, miembro, usuario, esAdminPlataforma, permisos } = await requerirContexto();
  const editor = puedeEditarFinanzas(miembro.rol, esAdminPlataforma);
  const junta = editor || esAdministrador(permisos);
  const supabase = await crearClienteServidor();
  const hoy = hoyISO();

  const fincas = await cargarFincas(supabase, comunidad.id);
  const finca = fincas.find((fila) => fila.id === fincaId);
  if (!finca) notFound();

  // Un vecino solo ve la cuenta de sus viviendas
  if (!junta) {
    const { data: titular } = await supabase
      .from("titulares")
      .select("id")
      .eq("finca_id", finca.id)
      .eq("usuario_id", usuario.id)
      .or(`hasta.is.null,hasta.gte.${hoy}`)
      .limit(1)
      .maybeSingle();
    if (!titular) notFound();
  }

  const { data: filas } = await supabase
    .from("recibos")
    .select(COLUMNAS_RECIBO)
    .eq("finca_id", finca.id)
    .order("periodo", { ascending: false })
    .order("concepto");
  const recibos = normalizarRecibos(filas);
  const resumen = resumirRecibos(recibos, hoy);

  return (
    <div>
      <CabeceraPagina
        titulo={finca.codigo}
        icono={Home}
        descripcion={finca.titulares.length > 0 ? finca.titulares.join(", ") : "Sin titular"}
      />
      <p className="mb-4">
        <Link href="/finanzas/recibos" className="text-sm text-suave hover:underline">
          ← Volver a Recibos
        </Link>
      </p>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="tarjeta p-4">
          <p className="text-xs text-suave">Coeficiente</p>
          <p className="font-titulo text-xl font-semibold tabular-nums">
            {formatoCoeficiente(finca.coeficiente)} %
          </p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-xs text-suave">Emitido</p>
          <p className="font-titulo text-xl font-semibold tabular-nums">{formatoMoneda(resumen.emitido)}</p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-xs text-suave">Cobrado</p>
          <p className="font-titulo text-xl font-semibold tabular-nums">{formatoMoneda(resumen.cobrado)}</p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-xs text-suave">Pendiente</p>
          <p
            className={
              resumen.vencido > 0
                ? "font-titulo text-xl font-semibold tabular-nums text-peligro"
                : "font-titulo text-xl font-semibold tabular-nums"
            }
          >
            {resumen.pendiente > 0 ? formatoMoneda(resumen.pendiente) : "Al corriente"}
          </p>
          {resumen.deudaDesde && (
            <p className="mt-0.5 text-xs text-peligro">
              Debe desde {nombrePeriodo(resumen.deudaDesde)}
            </p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="sobretitulo mb-3">Recibos ({recibos.length})</h2>
        <ListaRecibos recibos={recibos} editable={editor} hoy={hoy} mostrarPagos />
      </section>
    </div>
  );
}
