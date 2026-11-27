import Link from "next/link";
import { redirect } from "next/navigation";
import { Calculator, ChevronLeft, ChevronRight } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { formatoCoeficiente } from "@/lib/coeficientes";
import { esAdministrador, puedeEditarFinanzas, puedeVerFinanzas } from "@/lib/permisos";
import { cuotaMensualDe, parteDe } from "@/lib/presupuestos";
import { cobradoDe, hoyISO, pendienteDe } from "@/lib/recibos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFecha, formatoMoneda } from "@/lib/utilidades";
import { CabeceraPagina } from "@/components/ui/CabeceraPagina";
import { EtiquetaEstado } from "@/components/ui/EtiquetaEstado";
import { cargarFincas, COLUMNAS_RECIBO, normalizarRecibos } from "../recibos/datos";
import { BotonImprimir } from "@/components/ui/BotonImprimir";
import { AccionesPresupuesto, CrearPresupuesto } from "./Acciones";
import { FilaPartida, NuevaPartida, type Partida } from "./Partidas";

export const metadata = { title: "Presupuesto y cuentas" };

function centimos(valor: number | string | null | undefined) {
  return Math.round(Number(valor ?? 0) * 100);
}

export default async function PaginaPresupuesto(props: PageProps<"/finanzas/presupuesto">) {
  const { comunidad, permisos } = await requerirContexto();
  if (!puedeVerFinanzas(permisos)) redirect("/panel");

  const editor = puedeEditarFinanzas(permisos);
  const junta = editor || esAdministrador(permisos);
  const supabase = await crearClienteServidor();
  const hoy = hoyISO();

  const parametros = await props.searchParams;
  const pedido = Number(typeof parametros.ejercicio === "string" ? parametros.ejercicio : NaN);
  const ejercicio = Number.isInteger(pedido) && pedido >= 2000 && pedido <= 2100 ? pedido : Number(hoy.slice(0, 4));
  const desde = `${ejercicio}-01-01`;
  const hasta = `${ejercicio}-12-31`;

  const [
    { data: presupuesto },
    { data: anterior },
    { data: categorias },
    { data: gastos },
    { data: ingresos },
    { data: cobros },
  ] = await Promise.all([
    supabase
      .from("presupuestos")
      .select("id, estado, total_gastos, total_ingresos, aprobado_en, partidas_presupuesto(id, concepto, tipo, categoria_id, importe, creado_en)")
      .eq("comunidad_id", comunidad.id)
      .eq("ejercicio", ejercicio)
      .maybeSingle(),
    supabase
      .from("presupuestos")
      .select("id")
      .eq("comunidad_id", comunidad.id)
      .eq("ejercicio", ejercicio - 1)
      .maybeSingle(),
    supabase
      .from("categorias_gasto")
      .select("id, nombre")
      .eq("comunidad_id", comunidad.id)
      .eq("tipo", "gasto")
      .order("nombre"),
    supabase
      .from("gastos")
      .select("total, categoria_id")
      .eq("comunidad_id", comunidad.id)
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase
      .from("ingresos")
      .select("importe")
      .eq("comunidad_id", comunidad.id)
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase.rpc("cobros_por_mes", { p_comunidad_id: comunidad.id, p_desde: desde, p_hasta: hasta }),
  ]);

  const nombresCategorias = new Map((categorias ?? []).map((categoria) => [categoria.id, categoria.nombre]));
  const partidas: Partida[] = (presupuesto?.partidas_presupuesto ?? [])
    .map((partida) => ({ ...partida, importe: Number(partida.importe) }))
    .sort((a, b) => a.creado_en.localeCompare(b.creado_en));
  const partidasGasto = partidas.filter((partida) => partida.tipo === "gasto");
  const partidasIngreso = partidas.filter((partida) => partida.tipo === "ingreso");
  const editable = editor && presupuesto?.estado === "borrador";
  const cuotaResultante = presupuesto ? cuotaMensualDe(presupuesto) : 0;

  // Presupuestado frente a real, por categoria de gasto
  const comparacion = new Map<string, { nombre: string; previsto: number; real: number }>();
  const clave = (id: string | null) => id ?? "";
  const nombre = (id: string | null) => (id && nombresCategorias.get(id)) || "Sin categoría";
  for (const partida of partidasGasto) {
    const fila = comparacion.get(clave(partida.categoria_id)) ?? { nombre: nombre(partida.categoria_id), previsto: 0, real: 0 };
    fila.previsto += centimos(partida.importe);
    comparacion.set(clave(partida.categoria_id), fila);
  }
  for (const gasto of gastos ?? []) {
    const fila = comparacion.get(clave(gasto.categoria_id)) ?? { nombre: nombre(gasto.categoria_id), previsto: 0, real: 0 };
    fila.real += centimos(gasto.total);
    comparacion.set(clave(gasto.categoria_id), fila);
  }
  const filasComparacion = [...comparacion.values()].sort((a, b) => b.previsto - a.previsto || b.real - a.real);

  // Liquidacion del ejercicio
  const gastoReal = (gastos ?? []).reduce((total, gasto) => total + centimos(gasto.total), 0) / 100;
  const cobradoCuotas = (cobros ?? []).reduce((total, fila) => total + centimos(fila.total), 0) / 100;
  const otrosIngresos = (ingresos ?? []).reduce((total, ingreso) => total + centimos(ingreso.importe), 0) / 100;
  const resultado = Math.round((cobradoCuotas + otrosIngresos - gastoReal) * 100) / 100;

  // Reparto por vivienda: solo la junta, que ve los recibos de todos
  const coeficienteTotal = Number(comunidad.coeficiente_total) || 100;
  let porVivienda: {
    id: string;
    codigo: string;
    titulares: string[];
    coeficiente: number;
    parteGasto: number;
    emitido: number;
    cobrado: number;
    pendiente: number;
  }[] = [];
  if (junta) {
    const [fincas, { data: filasRecibos }] = await Promise.all([
      cargarFincas(supabase, comunidad.id),
      supabase
        .from("recibos")
        .select(COLUMNAS_RECIBO)
        .eq("comunidad_id", comunidad.id)
        .gte("periodo", desde)
        .lte("periodo", hasta),
    ]);
    const recibos = normalizarRecibos(filasRecibos).filter((recibo) => recibo.estado !== "anulado");
    porVivienda = fincas.map((finca) => {
      const propios = recibos.filter((recibo) => recibo.finca_id === finca.id);
      return {
        id: finca.id,
        codigo: finca.codigo,
        titulares: finca.titulares,
        coeficiente: finca.coeficiente,
        parteGasto: parteDe(gastoReal, finca.coeficiente, coeficienteTotal),
        emitido: propios.reduce((total, recibo) => total + centimos(recibo.importe), 0) / 100,
        cobrado: propios.reduce((total, recibo) => total + centimos(cobradoDe(recibo)), 0) / 100,
        pendiente: propios.reduce((total, recibo) => total + centimos(pendienteDe(recibo)), 0) / 100,
      };
    });
  }

  return (
    <div>
      <CabeceraPagina
        titulo={`Presupuesto y cuentas ${ejercicio}`}
        icono={Calculator}
        descripcion="Lo previsto para el año, lo gastado de verdad y la liquidación para la junta"
        accion={<BotonImprimir />}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/finanzas" className="text-sm text-suave hover:underline">
          ← Volver a Finanzas
        </Link>
        <nav className="flex items-center gap-1" aria-label="Cambiar de ejercicio">
          <Link
            href={`/finanzas/presupuesto?ejercicio=${ejercicio - 1}`}
            className="grid size-11 place-items-center rounded-full text-suave hover:bg-hundido hover:text-tinta"
            aria-label="Ejercicio anterior"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <span className="font-semibold tabular-nums">{ejercicio}</span>
          <Link
            href={`/finanzas/presupuesto?ejercicio=${ejercicio + 1}`}
            className="grid size-11 place-items-center rounded-full text-suave hover:bg-hundido hover:text-tinta"
            aria-label="Ejercicio siguiente"
          >
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </nav>
      </div>

      {/* Presupuesto */}
      <section className="tarjeta">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Presupuesto ordinario</h2>
          {presupuesto && (
            <div className="flex items-center gap-2 text-sm text-suave">
              {presupuesto.aprobado_en && presupuesto.estado !== "borrador" && (
                <span>Aprobado el {formatoFecha(presupuesto.aprobado_en)}</span>
              )}
              <EtiquetaEstado estado={presupuesto.estado} />
            </div>
          )}
        </div>

        {!presupuesto ? (
          editor ? (
            <>
              <p className="mt-2 text-[15px] text-suave">
                Todavía no hay presupuesto de {ejercicio}. La junta ordinaria tiene que aprobar
                cada año el plan de gastos e ingresos (art. 14 y 16.1 LPH).
              </p>
              <CrearPresupuesto ejercicio={ejercicio} hayAnterior={Boolean(anterior)} />
            </>
          ) : (
            <p className="mt-2 text-sm text-suave">Todavía no hay presupuesto de {ejercicio}.</p>
          )
        ) : (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-hundido px-3 py-2.5">
                <dt className="text-xs text-suave">Gastos previstos</dt>
                <dd className="font-semibold tabular-nums">{formatoMoneda(presupuesto.total_gastos)}</dd>
              </div>
              <div className="rounded-xl bg-hundido px-3 py-2.5">
                <dt className="text-xs text-suave">Otros ingresos previstos</dt>
                <dd className="font-semibold tabular-nums">{formatoMoneda(presupuesto.total_ingresos)}</dd>
              </div>
              <div className="rounded-xl bg-hundido px-3 py-2.5">
                <dt className="text-xs text-suave">Cuota mensual que sale</dt>
                <dd className="font-semibold tabular-nums">{formatoMoneda(cuotaResultante)}</dd>
              </div>
              <div className="rounded-xl bg-hundido px-3 py-2.5">
                <dt className="text-xs text-suave">Cuota mensual actual</dt>
                <dd className="font-semibold tabular-nums">{formatoMoneda(comunidad.cuota_mensual)}</dd>
              </div>
            </dl>

            {editor && (
              <div className="mt-4 print:hidden">
                <AccionesPresupuesto
                  id={presupuesto.id}
                  estado={presupuesto.estado}
                  cuotaResultante={cuotaResultante}
                  cuotaActual={Number(comunidad.cuota_mensual ?? 0)}
                  hoy={hoy}
                />
              </div>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {(
                [
                  ["Gastos", partidasGasto],
                  ["Otros ingresos", partidasIngreso],
                ] as const
              ).map(([titulo, lista]) => (
                <div key={titulo}>
                  <h3 className="sobretitulo mb-2">
                    {titulo} ({lista.length})
                  </h3>
                  {lista.length > 0 ? (
                    <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde">
                      {lista.map((partida) => (
                        <FilaPartida
                          key={partida.id}
                          partida={partida}
                          categorias={categorias ?? []}
                          presupuestoId={presupuesto.id}
                          editable={editable}
                          nombreCategoria={
                            partida.categoria_id ? nombresCategorias.get(partida.categoria_id) ?? null : null
                          }
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-borde px-4 py-4 text-center text-sm text-suave">
                      Sin partidas.
                    </p>
                  )}
                </div>
              ))}
            </div>
            {editable && (
              <div className="mt-3 print:hidden">
                <NuevaPartida categorias={categorias ?? []} presupuestoId={presupuesto.id} />
              </div>
            )}
            {editor && presupuesto.estado !== "borrador" && (
              <p className="mt-3 text-xs text-suave print:hidden">
                Para cambiar las partidas, vuelve el presupuesto a borrador.
              </p>
            )}
          </>
        )}
      </section>

      {/* Presupuestado frente a real */}
      {filasComparacion.length > 0 && (
        <section className="mt-8">
          <h2 className="sobretitulo mb-3">Presupuestado frente a gastado</h2>
          <div className="overflow-x-auto rounded-2xl border border-borde bg-superficie">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-hundido text-left text-xs uppercase tracking-wider text-suave">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Categoría</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Previsto</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Gastado</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {filasComparacion.map((fila) => {
                  const diferencia = fila.previsto - fila.real;
                  return (
                    <tr key={fila.nombre}>
                      <td className="px-4 py-2.5 font-medium">{fila.nombre}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatoMoneda(fila.previsto / 100)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatoMoneda(fila.real / 100)}</td>
                      <td
                        className={
                          diferencia < 0
                            ? "px-4 py-2.5 text-right font-semibold tabular-nums text-peligro"
                            : "px-4 py-2.5 text-right tabular-nums text-suave"
                        }
                      >
                        {diferencia < 0 ? "−" : ""}
                        {formatoMoneda(Math.abs(diferencia) / 100)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-suave">
            En rojo, lo que se ha pasado del presupuesto. Los gastos se agrupan por su
            categoría.
          </p>
        </section>
      )}

      {/* Liquidacion */}
      <section className="mt-8">
        <h2 className="sobretitulo mb-3">Liquidación del ejercicio {ejercicio}</h2>
        <div className="tarjeta">
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-suave">Cuotas cobradas</dt>
              <dd className="tabular-nums">{formatoMoneda(cobradoCuotas)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-suave">Otros ingresos</dt>
              <dd className="tabular-nums">{formatoMoneda(otrosIngresos)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-suave">Gastos</dt>
              <dd className="tabular-nums">−{formatoMoneda(gastoReal)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-borde pt-2 font-semibold">
              <dt>{resultado >= 0 ? "Superávit" : "Déficit"}</dt>
              <dd className={resultado < 0 ? "tabular-nums text-peligro" : "tabular-nums text-exito"}>
                {formatoMoneda(resultado)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-suave">
            Cuenta lo cobrado y lo gastado con fecha de {ejercicio}. La junta ordinaria aprueba
            estas cuentas junto con el presupuesto del año siguiente.
          </p>
        </div>

        {junta && porVivienda.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-borde bg-superficie">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-hundido text-left text-xs uppercase tracking-wider text-suave">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Vivienda</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Coef.</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Le toca del gasto</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Recibos</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Pagado</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Pendiente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {porVivienda.map((fila) => (
                  <tr key={fila.id}>
                    <td className="px-4 py-2">
                      <span className="font-medium">{fila.codigo}</span>
                      {fila.titulares.length > 0 && (
                        <span className="block truncate text-xs text-suave">{fila.titulares.join(", ")}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatoCoeficiente(fila.coeficiente)} %</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatoMoneda(fila.parteGasto)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatoMoneda(fila.emitido)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatoMoneda(fila.cobrado)}</td>
                    <td
                      className={
                        fila.pendiente > 0
                          ? "px-4 py-2 text-right font-semibold tabular-nums text-peligro"
                          : "px-4 py-2 text-right tabular-nums text-suave"
                      }
                    >
                      {formatoMoneda(fila.pendiente)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
