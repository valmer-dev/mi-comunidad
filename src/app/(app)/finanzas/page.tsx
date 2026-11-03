import { ReceiptText, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador, puedeVerFinanzas } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFechaCorta, formatoMoneda, nombreMes } from "@/lib/utilidades";
import { CabeceraPagina, EstadoVacio } from "@/components/ui/CabeceraPagina";
import { EtiquetaEstado } from "@/components/ui/EtiquetaEstado";
import { NuevoGasto } from "./NuevoGasto";

export const metadata = { title: "Finanzas" };

export default async function PaginaFinanzas() {
  const { comunidad, permisos } = await requerirContexto();
  const supabase = await crearClienteServidor();
  const ejercicio = new Date().getFullYear();
  const verFinanzas = puedeVerFinanzas(permisos);
  const admin = esAdministrador(permisos);

  const [{ data: presupuesto }, { data: gastos }, { data: recibos }, { data: categorias }, { data: fincas }] =
    await Promise.all([
      supabase
        .from("presupuestos")
        .select("id, ejercicio, estado, total_ingresos, total_gastos")
        .eq("comunidad_id", comunidad.id)
        .eq("ejercicio", ejercicio)
        .maybeSingle(),
      supabase
        .from("gastos")
        .select("id, concepto, total, fecha, categoria_id")
        .eq("comunidad_id", comunidad.id)
        .eq("pagado", true)
        .gte("fecha", `${ejercicio}-01-01`)
        .lte("fecha", `${ejercicio}-12-31`)
        .order("fecha", { ascending: false }),
      supabase
        .from("recibos")
        .select("id, periodo, concepto, importe, estado, finca_id")
        .eq("comunidad_id", comunidad.id)
        .order("periodo", { ascending: false })
        .limit(60),
      supabase
        .from("categorias_gasto")
        .select("id, nombre")
        .eq("comunidad_id", comunidad.id)
        .eq("tipo", "gasto")
        .order("nombre"),
      supabase.from("fincas").select("id, codigo").eq("comunidad_id", comunidad.id),
    ]);

  const gastado = (gastos ?? []).reduce((total, gasto) => total + Number(gasto.total), 0);
  const pendiente = (recibos ?? [])
    .filter((recibo) => recibo.estado === "pendiente")
    .reduce((total, recibo) => total + Number(recibo.importe), 0);

  const mapaFincas = new Map((fincas ?? []).map((finca) => [finca.id, finca.codigo]));
  const mapaCategorias = new Map((categorias ?? []).map((categoria) => [categoria.id, categoria.nombre]));

  return (
    <div>
      <CabeceraPagina
        titulo="Finanzas"
        descripcion={verFinanzas ? `Ejercicio ${ejercicio}` : "Tus cuotas y recibos"}
        accion={admin ? <NuevoGasto categorias={categorias ?? []} /> : undefined}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="tarjeta p-4">
          <span className="grid size-9 place-items-center rounded-xl bg-principal/10 text-principal">
            <Wallet className="size-[18px]" aria-hidden />
          </span>
          <p className="mt-3 text-xs text-suave">Presupuesto anual</p>
          <p className="text-xl font-bold">{formatoMoneda(presupuesto?.total_gastos ?? 0)}</p>
          <p className="mt-0.5 text-xs text-suave">
            {presupuesto ? `Estado: ${presupuesto.estado}` : "Sin presupuesto aprobado"}
          </p>
        </div>

        <div className="tarjeta p-4">
          <span className="grid size-9 place-items-center rounded-xl bg-acento-claro text-acento">
            <TrendingDown className="size-[18px]" aria-hidden />
          </span>
          <p className="mt-3 text-xs text-suave">Gastado este año</p>
          <p className="text-xl font-bold">{formatoMoneda(gastado)}</p>
          {Number(presupuesto?.total_gastos ?? 0) > 0 && (
            <p className="mt-0.5 text-xs text-suave">
              {Math.round((gastado / Number(presupuesto?.total_gastos)) * 100)} % del presupuesto
            </p>
          )}
        </div>

        <div className="tarjeta col-span-2 p-4 lg:col-span-1">
          <span className="grid size-9 place-items-center rounded-xl bg-blue-100 text-blue-700">
            <TrendingUp className="size-[18px]" aria-hidden />
          </span>
          <p className="mt-3 text-xs text-suave">
            {verFinanzas ? "Pendiente de cobro" : "Mis recibos pendientes"}
          </p>
          <p className="text-xl font-bold">{formatoMoneda(pendiente)}</p>
          <p className="mt-0.5 text-xs text-suave">
            {(recibos ?? []).filter((r) => r.estado === "pendiente").length} recibos
          </p>
        </div>
      </section>

      {verFinanzas && gastos && gastos.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-suave">
            Últimos gastos
          </h2>
          <div className="overflow-hidden rounded-2xl border border-borde bg-superficie">
            <table className="w-full text-sm">
              <thead className="bg-fondo text-left text-xs uppercase tracking-wide text-suave">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Concepto</th>
                  <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Categoría</th>
                  <th className="px-4 py-2.5 font-semibold">Fecha</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {gastos.slice(0, 12).map((gasto) => (
                  <tr key={gasto.id}>
                    <td className="px-4 py-2.5 font-medium">{gasto.concepto}</td>
                    <td className="hidden px-4 py-2.5 text-suave sm:table-cell">
                      {gasto.categoria_id ? mapaCategorias.get(gasto.categoria_id) ?? "—" : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-suave">{formatoFechaCorta(gasto.fecha)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatoMoneda(gasto.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-suave">
          {verFinanzas ? "Recibos" : "Mis recibos"} ({(recibos ?? []).length})
        </h2>
        {recibos && recibos.length > 0 ? (
          <ul className="space-y-2">
            {recibos.slice(0, 24).map((recibo) => (
              <li
                key={recibo.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-borde bg-superficie px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{recibo.concepto}</p>
                  <p className="text-xs text-suave">
                    {nombreMes(recibo.periodo)}
                    {verFinanzas && recibo.finca_id
                      ? ` · ${mapaFincas.get(recibo.finca_id) ?? "Finca"}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold tabular-nums">
                    {formatoMoneda(recibo.importe)}
                  </span>
                  <EtiquetaEstado estado={recibo.estado} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EstadoVacio
            titulo="Todavía no hay recibos"
            descripcion={
              verFinanzas
                ? "Cuando se generen las cuotas mensuales aparecerán aquí."
                : "Cuando la comunidad emita tus cuotas aparecerán aquí."
            }
            accion={<ReceiptText className="size-8 text-suave/50" aria-hidden />}
          />
        )}
      </section>
    </div>
  );
}
