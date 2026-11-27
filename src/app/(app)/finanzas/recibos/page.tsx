import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, CircleDollarSign, Clock, ReceiptText } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador, puedeEditarFinanzas } from "@/lib/permisos";
import { hoyISO, mesDe, nombrePeriodo, resumirRecibos } from "@/lib/recibos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFechaCorta, formatoMoneda } from "@/lib/utilidades";
import { CabeceraPagina } from "@/components/ui/CabeceraPagina";
import { cargarFincas, COLUMNAS_RECIBO, normalizarRecibos } from "./datos";
import { GenerarRecibos } from "./GenerarRecibos";
import { ListaRecibos } from "./ListaRecibos";

export const metadata = { title: "Recibos" };

function desplazarMes(mes: string, delta: number) {
  const [anio, numero] = mes.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, numero - 1 + delta, 1));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function PaginaRecibos(props: PageProps<"/finanzas/recibos">) {
  const { comunidad, miembro, usuario, esAdminPlataforma, permisos } = await requerirContexto();
  const editor = puedeEditarFinanzas(miembro.rol, esAdminPlataforma);
  const junta = editor || esAdministrador(permisos);
  const supabase = await crearClienteServidor();
  const hoy = hoyISO();

  const parametros = await props.searchParams;
  const mesPedido = typeof parametros.mes === "string" ? parametros.mes : "";
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(mesPedido) ? mesPedido : mesDe(hoy);

  if (!junta) {
    return <MisRecibos usuarioId={usuario.id} comunidadId={comunidad.id} hoy={hoy} />;
  }

  const [fincas, { data: filas }] = await Promise.all([
    cargarFincas(supabase, comunidad.id),
    supabase
      .from("recibos")
      .select(COLUMNAS_RECIBO)
      .eq("comunidad_id", comunidad.id)
      .order("periodo", { ascending: false }),
  ]);

  const recibos = normalizarRecibos(filas);
  const mapaFincas = new Map(fincas.map((finca) => [finca.id, finca]));
  const ordenFincas = new Map(fincas.map((finca, indice) => [finca.id, indice]));

  const delMes = recibos
    .filter((recibo) => mesDe(recibo.periodo) === mes)
    .sort(
      (a, b) =>
        (ordenFincas.get(a.finca_id) ?? 0) - (ordenFincas.get(b.finca_id) ?? 0) ||
        a.concepto.localeCompare(b.concepto),
    );

  const total = resumirRecibos(recibos, hoy);
  const resumenMes = resumirRecibos(delMes, hoy);

  const porFinca = fincas.map((finca) => ({
    finca,
    resumen: resumirRecibos(
      recibos.filter((recibo) => recibo.finca_id === finca.id),
      hoy,
    ),
  }));
  const conDeuda = porFinca.filter((fila) => fila.resumen.pendiente > 0);

  return (
    <div>
      <CabeceraPagina
        titulo="Recibos"
        icono={ReceiptText}
        descripcion="Cuotas de cada vivienda, cobros y lo que queda pendiente"
        accion={
          editor ? (
            <GenerarRecibos
              mesInicial={mes}
              importeInicial={Number(comunidad.cuota_mensual ?? 0)}
              fincasConCoeficiente={fincas.filter((finca) => finca.coeficiente > 0).length}
            />
          ) : undefined
        }
      />

      <p className="mb-4">
        <Link href="/finanzas" className="text-sm text-suave hover:underline">
          ← Volver a Finanzas
        </Link>
      </p>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="tarjeta p-4">
          <span className="icono-seccion bg-atencion-claro text-atencion">
            <Clock className="size-[18px]" aria-hidden />
          </span>
          <p className="mt-3 text-xs text-suave">Pendiente de cobro</p>
          <p className="font-titulo text-xl font-semibold tabular-nums">{formatoMoneda(total.pendiente)}</p>
          <p className="mt-0.5 text-xs text-suave">
            {total.recibosPendientes} {total.recibosPendientes === 1 ? "recibo" : "recibos"}
          </p>
        </div>
        <div className="tarjeta p-4">
          <span className="icono-seccion bg-peligro-claro text-peligro">
            <AlertTriangle className="size-[18px]" aria-hidden />
          </span>
          <p className="mt-3 text-xs text-suave">Vencido sin pagar</p>
          <p className="font-titulo text-xl font-semibold tabular-nums">{formatoMoneda(total.vencido)}</p>
          <p className="mt-0.5 text-xs text-suave">
            {conDeuda.length} {conDeuda.length === 1 ? "vivienda" : "viviendas"} con deuda
          </p>
        </div>
        <div className="tarjeta col-span-2 p-4 lg:col-span-1">
          <span className="icono-seccion bg-exito-claro text-exito">
            <CircleDollarSign className="size-[18px]" aria-hidden />
          </span>
          <p className="mt-3 text-xs text-suave">Cobrado de {nombrePeriodo(`${mes}-01`)}</p>
          <p className="font-titulo text-xl font-semibold tabular-nums">
            {formatoMoneda(resumenMes.cobrado)}
          </p>
          <p className="mt-0.5 text-xs text-suave">de {formatoMoneda(resumenMes.emitido)} emitidos</p>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="sobretitulo">Recibos de {nombrePeriodo(`${mes}-01`)}</h2>
          <nav className="flex items-center gap-1" aria-label="Cambiar de mes">
            <Link
              href={`/finanzas/recibos?mes=${desplazarMes(mes, -1)}`}
              className="grid size-11 place-items-center rounded-full text-suave hover:bg-hundido hover:text-tinta"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </Link>
            <Link
              href={`/finanzas/recibos?mes=${desplazarMes(mes, 1)}`}
              className="grid size-11 place-items-center rounded-full text-suave hover:bg-hundido hover:text-tinta"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="size-5" aria-hidden />
            </Link>
          </nav>
        </div>
        {delMes.length > 0 ? (
          <ListaRecibos recibos={delMes} fincas={mapaFincas} editable={editor} hoy={hoy} />
        ) : (
          <p className="rounded-2xl border border-dashed border-borde bg-superficie px-4 py-6 text-center text-sm text-suave">
            No hay recibos de este mes.{editor && " Usa «Generar recibos» para crearlos."}
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="sobretitulo mb-3">Estado de cuentas por vivienda</h2>
        {fincas.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-borde bg-superficie">
            <table className="w-full text-sm">
              <thead className="bg-hundido text-left text-xs uppercase tracking-wider text-suave">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Vivienda</th>
                  <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Debe desde</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Pendiente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {porFinca.map(({ finca, resumen }) => (
                  <tr key={finca.id}>
                    <td className="px-4 py-2.5">
                      <Link href={`/finanzas/recibos/${finca.id}`} className="font-medium hover:underline">
                        {finca.codigo}
                      </Link>
                      <p className="truncate text-xs text-suave">
                        {finca.titulares.length > 0 ? finca.titulares.join(", ") : "Sin titular"}
                      </p>
                    </td>
                    <td className="hidden px-4 py-2.5 text-suave sm:table-cell">
                      {resumen.deudaDesde ? nombrePeriodo(resumen.deudaDesde) : "—"}
                    </td>
                    <td
                      className={
                        resumen.vencido > 0
                          ? "px-4 py-2.5 text-right font-semibold tabular-nums text-peligro"
                          : "px-4 py-2.5 text-right tabular-nums"
                      }
                    >
                      {resumen.pendiente > 0 ? formatoMoneda(resumen.pendiente) : "Al corriente"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-suave">Todavía no hay fincas.</p>
        )}
        <p className="mt-2 text-xs text-suave">
          Calculado a {formatoFechaCorta(hoy)}. Solo la junta directiva ve la deuda de cada vivienda;
          cada vecino ve únicamente la suya.
        </p>
      </section>
    </div>
  );
}

/** Lo que ve un vecino: sus viviendas y sus recibos. */
async function MisRecibos({
  usuarioId,
  comunidadId,
  hoy,
}: {
  usuarioId: string;
  comunidadId: string;
  hoy: string;
}) {
  const supabase = await crearClienteServidor();
  const fincas = await cargarFincas(supabase, comunidadId);
  const { data: mias } = await supabase
    .from("titulares")
    .select("finca_id")
    .eq("usuario_id", usuarioId)
    .or(`hasta.is.null,hasta.gte.${hoy}`);
  const ids = new Set((mias ?? []).map((fila) => fila.finca_id));
  const misFincas = fincas.filter((finca) => ids.has(finca.id));

  const { data: filas } = misFincas.length
    ? await supabase
        .from("recibos")
        .select(COLUMNAS_RECIBO)
        .in("finca_id", [...ids])
        .order("periodo", { ascending: false })
    : { data: [] };
  const recibos = normalizarRecibos(filas);

  return (
    <div>
      <CabeceraPagina titulo="Mis recibos" icono={ReceiptText} descripcion="Tus cuotas y lo que tienes pendiente" />
      <p className="mb-4">
        <Link href="/finanzas" className="text-sm text-suave hover:underline">
          ← Volver a Finanzas
        </Link>
      </p>

      {misFincas.length === 0 && (
        <p className="rounded-2xl border border-dashed border-borde bg-superficie px-4 py-6 text-center text-sm text-suave">
          No figuras como titular de ninguna vivienda. Si es un error, habla con el presidente.
        </p>
      )}

      {misFincas.map((finca) => {
        const deLaFinca = recibos.filter((recibo) => recibo.finca_id === finca.id);
        const resumen = resumirRecibos(deLaFinca, hoy);
        return (
          <section key={finca.id} className="mb-8">
            <div className="tarjeta mb-3 flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <h2 className="text-lg font-semibold">{finca.codigo}</h2>
                <p className="text-xs text-suave">
                  Coeficiente {finca.coeficiente.toLocaleString("es-ES", { maximumFractionDigits: 4 })} %
                </p>
              </div>
              <div className="text-right">
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
              </div>
            </div>
            <ListaRecibos recibos={deLaFinca} editable={false} hoy={hoy} mostrarPagos />
          </section>
        );
      })}
    </div>
  );
}
