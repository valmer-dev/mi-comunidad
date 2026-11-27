import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ChevronRight, ReceiptText, TrendingDown, Wallet } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador, puedeEditarFinanzas, puedeVerFinanzas } from "@/lib/permisos";
import { hoyISO, resumirRecibos } from "@/lib/recibos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFechaCorta, formatoMoneda, nombreMes } from "@/lib/utilidades";
import { CabeceraPagina } from "@/components/ui/CabeceraPagina";
import { NuevoGasto } from "./NuevoGasto";
import { COLUMNAS_RECIBO, normalizarRecibos } from "./recibos/datos";
import { ResumenMensual } from "./ResumenMensual";
import { TarjetaCuota } from "./TarjetaCuota";

export const metadata = { title: "Finanzas" };

export default async function PaginaFinanzas() {
  const { miembro, comunidad, esAdminPlataforma, permisos } = await requerirContexto();
  const supabase = await crearClienteServidor();

  const verFinanzas = puedeVerFinanzas(permisos);
  if (!verFinanzas) redirect("/panel");

  const editaFinanzas = puedeEditarFinanzas(miembro.rol, esAdminPlataforma);
  const ahora = new Date();
  const ejercicio = ahora.getFullYear();

  const [{ data: gastos }, { data: categorias }] = await Promise.all([
    supabase
      .from("gastos")
      .select("id, concepto, total, fecha, categoria_id")
      .eq("comunidad_id", comunidad.id)
      .gte("fecha", `${ejercicio}-01-01`)
      .lte("fecha", `${ejercicio}-12-31`)
      .order("fecha", { ascending: false }),
    supabase
      .from("categorias_gasto")
      .select("id, nombre")
      .eq("comunidad_id", comunidad.id)
      .eq("tipo", "gasto")
      .order("nombre"),
  ]);

  const listaGastos = gastos ?? [];

  // Resumen de recibos: la junta ve el total pendiente de la comunidad; un
  // vecino, por las politicas de la base de datos, solo los suyos.
  const junta = editaFinanzas || esAdministrador(permisos);
  const { data: filasRecibos } = await supabase
    .from("recibos")
    .select(COLUMNAS_RECIBO)
    .eq("comunidad_id", comunidad.id);
  const resumenRecibos = resumirRecibos(normalizarRecibos(filasRecibos), hoyISO());

  // Un gasto cuenta desde que se registra, aunque todavia no se haya marcado
  // como pagado: antes se filtraba por pagado = true y los gastos nuevos no
  // aparecian en los totales.
  const totalesPorMes = Array.from({ length: 12 }, () => 0);
  for (const gasto of listaGastos) {
    const mes = Number(gasto.fecha.slice(5, 7)) - 1;
    if (mes >= 0 && mes < 12) totalesPorMes[mes] += Number(gasto.total);
  }

  const gastadoAnio = listaGastos.reduce((total, gasto) => total + Number(gasto.total), 0);
  const gastadoMes = totalesPorMes[ahora.getMonth()] ?? 0;

  const mapaCategorias = new Map(
    (categorias ?? []).map((categoria) => [categoria.id, categoria.nombre]),
  );

  return (
    <div>
      <CabeceraPagina
        titulo="Finanzas"
        icono={Wallet}
        descripcion={`Gastos de la comunidad · Ejercicio ${ejercicio}`}
        accion={editaFinanzas ? <NuevoGasto categorias={categorias ?? []} /> : undefined}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="tarjeta p-4">
          <span className="icono-seccion bg-acento-claro text-acento">
            <TrendingDown className="size-[18px]" aria-hidden />
          </span>
          <p className="mt-3 text-xs text-suave">Gastado este año</p>
          <p className="font-titulo text-xl font-semibold tabular-nums">{formatoMoneda(gastadoAnio)}</p>
          <p className="mt-0.5 text-xs text-suave">
            {listaGastos.length} {listaGastos.length === 1 ? "gasto" : "gastos"} registrados
          </p>
        </div>

        <div className="tarjeta p-4">
          <span className="icono-seccion bg-exito-claro text-exito">
            <CalendarDays className="size-[18px]" aria-hidden />
          </span>
          <p className="mt-3 text-xs text-suave">Gastado este mes</p>
          <p className="font-titulo text-xl font-semibold tabular-nums">{formatoMoneda(gastadoMes)}</p>
          <p className="mt-0.5 text-xs capitalize text-suave">{nombreMes(ahora)}</p>
        </div>

        <TarjetaCuota
          className="col-span-2 lg:col-span-1"
          cuota={Number(comunidad.cuota_mensual ?? 0)}
          puedeEditar={editaFinanzas}
        />
      </section>

      <Link
        href="/finanzas/recibos"
        className="tarjeta mt-3 flex items-center gap-3 p-4 transition-colors hover:bg-hundido"
      >
        <span className="icono-seccion bg-atencion-claro text-atencion">
          <ReceiptText className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{junta ? "Recibos y cobros" : "Mis recibos"}</p>
          <p className="text-xs text-suave">
            {resumenRecibos.pendiente > 0
              ? `${formatoMoneda(resumenRecibos.pendiente)} pendientes${
                  resumenRecibos.vencido > 0 ? ` · ${formatoMoneda(resumenRecibos.vencido)} vencidos` : ""
                }`
              : junta
                ? "Cuotas de cada vivienda y estado de cuentas"
                : "Estás al corriente de pago"}
          </p>
        </div>
        <ChevronRight className="size-5 text-suave" aria-hidden />
      </Link>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="sobretitulo">
            Resumen mensual de gastos
          </h2>
          <span className="text-xs text-suave">Ejercicio {ejercicio}</span>
        </div>
        <div className="tarjeta p-4 sm:p-5">
          <ResumenMensual anio={ejercicio} totales={totalesPorMes} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="sobretitulo mb-3">
          Últimos gastos ({listaGastos.length})
        </h2>
        {listaGastos.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-borde bg-superficie">
            <table className="w-full text-sm">
              <thead className="bg-hundido text-left text-xs uppercase tracking-wider text-suave">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Concepto</th>
                  <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Categoría</th>
                  <th className="px-4 py-2.5 font-semibold">Fecha</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {listaGastos.slice(0, 24).map((gasto) => (
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
        ) : (
          <p className="rounded-2xl border border-dashed border-borde bg-superficie px-4 py-6 text-center text-sm text-suave">
            Todavía no hay gastos registrados este año.
          </p>
        )}
      </section>
    </div>
  );
}
