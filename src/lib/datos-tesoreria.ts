import type { crearClienteServidor } from "@/lib/supabase/servidor";
import { calcularSaldo, minimoFondo, saldoFondo } from "@/lib/tesoreria";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

type ComunidadTesoreria = {
  id: string;
  saldo_inicial: number | string | null;
  saldo_inicial_fecha: string | null;
  cuota_mensual: number | string | null;
};

/**
 * Saldo en cuenta y fondo de reserva de la comunidad. Lo usan Finanzas y el
 * Panel, para que los dos muestren la misma cifra.
 *
 * saldo = saldo inicial + cuotas cobradas + otros ingresos - gastos, desde la
 * fecha del saldo inicial. El minimo legal del fondo es el 10 % del ultimo
 * presupuesto ordinario aprobado; sin presupuesto se estima con la cuota
 * mensual por 12.
 */
export async function cargarTesoreria(supabase: Cliente, comunidad: ComunidadTesoreria) {
  const desdeSaldo = comunidad.saldo_inicial_fecha ?? "2000-01-01";

  const [
    { data: cobros },
    { data: ingresos },
    { data: gastos },
    { data: movimientosFondo },
    { data: ultimoPresupuesto },
  ] = await Promise.all([
    supabase.rpc("cobros_por_mes", {
      p_comunidad_id: comunidad.id,
      p_desde: desdeSaldo,
      p_hasta: "2999-12-31",
    }),
    supabase
      .from("ingresos")
      .select("importe")
      .eq("comunidad_id", comunidad.id)
      .gte("fecha", desdeSaldo),
    supabase
      .from("gastos")
      .select("total")
      .eq("comunidad_id", comunidad.id)
      .gte("fecha", desdeSaldo),
    supabase
      .from("movimientos_fondo")
      .select("id, tipo, concepto, importe, fecha")
      .eq("comunidad_id", comunidad.id)
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false }),
    supabase
      .from("presupuestos")
      .select("ejercicio, total_gastos")
      .eq("comunidad_id", comunidad.id)
      .in("estado", ["aprobado", "cerrado"])
      .order("ejercicio", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const { saldo } = calcularSaldo({
    saldoInicial: comunidad.saldo_inicial,
    cobros: cobros ?? [],
    ingresos: ingresos ?? [],
    gastos: gastos ?? [],
  });

  const fondo = saldoFondo(movimientosFondo ?? []);
  const presupuestoOrdinario = ultimoPresupuesto
    ? Number(ultimoPresupuesto.total_gastos)
    : Number(comunidad.cuota_mensual ?? 0) * 12;
  const minimo = minimoFondo(presupuestoOrdinario);
  const fondoBajo = presupuestoOrdinario > 0 && fondo < minimo;

  return {
    saldo,
    fondo,
    minimo,
    fondoBajo,
    presupuestoOrdinario,
    ultimoPresupuesto: ultimoPresupuesto ?? null,
    movimientosFondo: movimientosFondo ?? [],
  };
}
