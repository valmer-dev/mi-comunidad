import Link from "next/link";
import { redirect } from "next/navigation";
import { Calculator, CalendarDays, ChevronRight, PiggyBank, ReceiptText, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador, puedeEditarFinanzas, puedeVerFinanzas } from "@/lib/permisos";
import { hoyISO, resumirRecibos } from "@/lib/recibos";
import { calcularSaldo, minimoFondo, PORCENTAJE_MINIMO_FONDO, saldoFondo } from "@/lib/tesoreria";
import { eliminarIngreso, eliminarMovimientoFondo } from "@/app/acciones/tesoreria";
import { BotonEliminar } from "@/components/ui/BotonEliminar";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFechaCorta, formatoMoneda, nombreMes } from "@/lib/utilidades";
import { CabeceraPagina } from "@/components/ui/CabeceraPagina";
import { FormularioMovimiento } from "./FormularioMovimiento";
import { NuevoGasto } from "./NuevoGasto";
import { COLUMNAS_RECIBO, normalizarRecibos } from "./recibos/datos";
import { ResumenMensual } from "./ResumenMensual";
import { TarjetaCuota } from "./TarjetaCuota";
import { TarjetaSaldo } from "./TarjetaSaldo";

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
  const hoy = hoyISO();
  const resumenRecibos = resumirRecibos(normalizarRecibos(filasRecibos), hoy);

  // Tesoreria: saldo desde el saldo inicial, ingresos del ejercicio y fondo
  // de reserva. Las cuotas cobradas llegan agregadas por mes.
  const desdeSaldo = comunidad.saldo_inicial_fecha ?? "2000-01-01";
  const [
    { data: cobrosAnio },
    { data: cobrosSaldo },
    { data: ingresosSaldo },
    { data: gastosSaldo },
    { data: movimientosFondo },
  ] = await Promise.all([
    supabase.rpc("cobros_por_mes", {
      p_comunidad_id: comunidad.id,
      p_desde: `${ejercicio}-01-01`,
      p_hasta: `${ejercicio}-12-31`,
    }),
    supabase.rpc("cobros_por_mes", {
      p_comunidad_id: comunidad.id,
      p_desde: desdeSaldo,
      p_hasta: "2999-12-31",
    }),
    supabase
      .from("ingresos")
      .select("id, concepto, importe, fecha")
      .eq("comunidad_id", comunidad.id)
      .gte("fecha", desdeSaldo < `${ejercicio}-01-01` ? desdeSaldo : `${ejercicio}-01-01`)
      .order("fecha", { ascending: false }),
    supabase
      .from("gastos")
      .select("total, fecha")
      .eq("comunidad_id", comunidad.id)
      .gte("fecha", desdeSaldo),
    supabase
      .from("movimientos_fondo")
      .select("id, tipo, concepto, importe, fecha")
      .eq("comunidad_id", comunidad.id)
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false }),
  ]);

  const listaIngresos = ingresosSaldo ?? [];
  const { saldo } = calcularSaldo({
    saldoInicial: comunidad.saldo_inicial,
    cobros: cobrosSaldo ?? [],
    ingresos: listaIngresos.filter((ingreso) => ingreso.fecha >= desdeSaldo),
    gastos: gastosSaldo ?? [],
  });
  const ingresosAnio = listaIngresos.filter((ingreso) => ingreso.fecha.startsWith(`${ejercicio}-`));
  const cobradoAnio = (cobrosAnio ?? []).reduce((total, fila) => total + Number(fila.total), 0);
  const ingresadoAnio =
    cobradoAnio + ingresosAnio.reduce((total, ingreso) => total + Number(ingreso.importe), 0);

  const fondo = saldoFondo(movimientosFondo ?? []);
  // Minimo legal: 10 % del ultimo presupuesto ordinario aprobado. Si aun no
  // hay ninguno, se estima con la cuota mensual por 12.
  const { data: ultimoPresupuesto } = await supabase
    .from("presupuestos")
    .select("ejercicio, total_gastos")
    .eq("comunidad_id", comunidad.id)
    .in("estado", ["aprobado", "cerrado"])
    .order("ejercicio", { ascending: false })
    .limit(1)
    .maybeSingle();
  const presupuestoOrdinario = ultimoPresupuesto
    ? Number(ultimoPresupuesto.total_gastos)
    : Number(comunidad.cuota_mensual ?? 0) * 12;
  const minimo = minimoFondo(presupuestoOrdinario);
  const fondoBajo = presupuestoOrdinario > 0 && fondo < minimo;

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
        <TarjetaSaldo
          saldo={saldo}
          saldoInicial={Number(comunidad.saldo_inicial ?? 0)}
          fechaInicial={comunidad.saldo_inicial_fecha}
          hoy={hoy}
          puedeEditar={editaFinanzas}
        />

        <div className="tarjeta p-4">
          <span
            className={
              fondoBajo
                ? "icono-seccion bg-peligro-claro text-peligro"
                : "icono-seccion bg-info-claro text-info"
            }
          >
            <PiggyBank className="size-[18px]" aria-hidden />
          </span>
          <p className="mt-3 text-xs text-suave">Fondo de reserva</p>
          <p className="font-titulo text-xl font-semibold tabular-nums">{formatoMoneda(fondo)}</p>
          <p className={fondoBajo ? "mt-0.5 text-xs font-semibold text-peligro" : "mt-0.5 text-xs text-suave"}>
            {presupuestoOrdinario > 0
              ? `${fondoBajo ? "Por debajo del" : "Mínimo legal"} ${formatoMoneda(minimo)}`
              : "Pon la cuota mensual para calcular el mínimo"}
          </p>
        </div>

        <div className="tarjeta p-4">
          <span className="icono-seccion bg-exito-claro text-exito">
            <TrendingUp className="size-[18px]" aria-hidden />
          </span>
          <p className="mt-3 text-xs text-suave">Ingresado este año</p>
          <p className="font-titulo text-xl font-semibold tabular-nums">{formatoMoneda(ingresadoAnio)}</p>
          <p className="mt-0.5 text-xs text-suave">{formatoMoneda(cobradoAnio)} de cuotas</p>
        </div>

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
          <span className="icono-seccion bg-neutro-claro text-neutro">
            <CalendarDays className="size-[18px]" aria-hidden />
          </span>
          <p className="mt-3 text-xs text-suave">Gastado este mes</p>
          <p className="font-titulo text-xl font-semibold tabular-nums">{formatoMoneda(gastadoMes)}</p>
          <p className="mt-0.5 text-xs capitalize text-suave">{nombreMes(ahora)}</p>
        </div>

        <TarjetaCuota
          cuota={Number(comunidad.cuota_mensual ?? 0)}
          puedeEditar={editaFinanzas}
        />
      </section>

      {fondoBajo && (
        <p className="aviso aviso-atencion mt-3">
          El fondo de reserva debe ser al menos el {PORCENTAJE_MINIMO_FONDO} % del presupuesto
          ordinario (art. 9.1.f de la Ley de Propiedad Horizontal). Faltan{" "}
          {formatoMoneda(minimo - fondo)}.{" "}
          {ultimoPresupuesto
            ? `Calculado sobre el presupuesto aprobado de ${ultimoPresupuesto.ejercicio}.`
            : "Sin presupuesto aprobado, se estima con la cuota mensual por 12."}
        </p>
      )}

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

      <Link
        href="/finanzas/presupuesto"
        className="tarjeta mt-3 flex items-center gap-3 p-4 transition-colors hover:bg-hundido"
      >
        <span className="icono-seccion bg-info-claro text-info">
          <Calculator className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Presupuesto y cuentas del año</p>
          <p className="text-xs text-suave">
            Previsto frente a gastado y liquidación para la junta ordinaria
          </p>
        </div>
        <ChevronRight className="size-5 text-suave" aria-hidden />
      </Link>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="sobretitulo">Otros ingresos ({ingresosAnio.length})</h2>
            {editaFinanzas && <FormularioMovimiento tipo="ingreso" hoy={hoy} />}
          </div>
          {ingresosAnio.length > 0 ? (
            <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
              {ingresosAnio.slice(0, 12).map((ingreso) => (
                <li key={ingreso.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{ingreso.concepto}</p>
                    <p className="text-xs text-suave">{formatoFechaCorta(ingreso.fecha)}</p>
                  </div>
                  <span className="tabular-nums text-exito">+{formatoMoneda(ingreso.importe)}</span>
                  {editaFinanzas && (
                    <BotonEliminar
                      accion={eliminarIngreso}
                      id={ingreso.id}
                      etiqueta="Borrar"
                      mensaje="¿Borrar este ingreso?"
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-borde bg-superficie px-4 py-5 text-center text-sm text-suave">
              Además de las cuotas: alquileres, subvenciones, intereses…
            </p>
          )}
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="sobretitulo">Fondo de reserva</h2>
            {editaFinanzas && <FormularioMovimiento tipo="fondo" hoy={hoy} />}
          </div>
          {(movimientosFondo ?? []).length > 0 ? (
            <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
              {(movimientosFondo ?? []).slice(0, 12).map((movimiento) => (
                <li key={movimiento.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{movimiento.concepto}</p>
                    <p className="text-xs text-suave">
                      {movimiento.tipo === "dotacion" ? "Aportación" : "Retirada"} ·{" "}
                      {formatoFechaCorta(movimiento.fecha)}
                    </p>
                  </div>
                  <span
                    className={
                      movimiento.tipo === "dotacion" ? "tabular-nums text-exito" : "tabular-nums text-peligro"
                    }
                  >
                    {movimiento.tipo === "dotacion" ? "+" : "−"}
                    {formatoMoneda(movimiento.importe)}
                  </span>
                  {editaFinanzas && (
                    <BotonEliminar
                      accion={eliminarMovimientoFondo}
                      id={movimiento.id}
                      etiqueta="Borrar"
                      mensaje="¿Borrar este movimiento del fondo?"
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-borde bg-superficie px-4 py-5 text-center text-sm text-suave">
              Apunta aquí lo que se aparta para el fondo y lo que se usa de él.
            </p>
          )}
          <p className="mt-2 text-xs text-suave">
            El fondo forma parte del saldo en cuenta: es dinero apartado para obras de
            conservación y reparaciones.
          </p>
        </section>
      </div>

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
