import Link from "next/link";
import { redirect } from "next/navigation";
import { Hammer } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador, puedeEditarFinanzas, puedeVerFinanzas } from "@/lib/permisos";
import { hoyISO } from "@/lib/recibos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoFechaCorta, formatoMoneda } from "@/lib/utilidades";
import { CabeceraPagina } from "@/components/ui/CabeceraPagina";
import { AnularDerrama } from "./AnularDerrama";
import { NuevaDerrama } from "./NuevaDerrama";

export const metadata = { title: "Derramas" };

type ReciboDerrama = {
  derrama_id: string | null;
  importe: number;
  estado: "pendiente" | "pagado" | "parcial" | "devuelto" | "aplazado" | "anulado";
  vence_en: string | null;
  pagos: { importe: number }[];
};

const centimos = (valor: number) => Math.round(valor * 100);
const cobradoDe = (r: ReciboDerrama) => r.pagos.reduce((t, p) => t + centimos(p.importe), 0) / 100;
const pendienteDe = (r: ReciboDerrama) =>
  r.estado === "anulado" ? 0 : Math.max(centimos(r.importe) - centimos(cobradoDe(r)), 0) / 100;

/**
 * Derramas: gastos extraordinarios aprobados en junta, cobrados aparte de la
 * cuota y repartidos por coeficiente en uno o varios plazos.
 */
export default async function PaginaDerramas() {
  const { miembro, comunidad, esAdminPlataforma, permisos } = await requerirContexto();
  if (!puedeVerFinanzas(permisos)) redirect("/panel");
  const editor = puedeEditarFinanzas(miembro.rol, esAdminPlataforma);
  const junta = editor || esAdministrador(permisos);
  const supabase = await crearClienteServidor();
  const hoy = hoyISO();

  const [{ data: derramas }, { data: filasRecibos }, { data: juntas }] = await Promise.all([
    supabase
      .from("derramas")
      .select("id, titulo, descripcion, importe_total, plazos, primer_vencimiento, meses_entre_plazos, punto_id, anulada_en, creado_en")
      .eq("comunidad_id", comunidad.id)
      .order("creado_en", { ascending: false }),
    supabase
      .from("recibos")
      .select("derrama_id, importe, estado, vence_en, pagos(importe)")
      .eq("comunidad_id", comunidad.id)
      .not("derrama_id", "is", null),
    supabase
      .from("juntas")
      .select("id, titulo, fecha_hora, puntos_del_dia(id, titulo, tipo)")
      .eq("comunidad_id", comunidad.id)
      .in("estado", ["celebrada", "cerrada"])
      .order("fecha_hora", { ascending: false })
      .limit(12),
  ]);

  const recibos = (filasRecibos ?? []).map((r) => ({
    ...r,
    importe: Number(r.importe),
    pagos: (r.pagos ?? []).map((p) => ({ importe: Number(p.importe) })),
  })) as ReciboDerrama[];

  const acuerdos = (juntas ?? []).flatMap((j) =>
    (j.puntos_del_dia ?? [])
      .filter((p) => p.tipo !== "informativo")
      .map((p) => ({ id: p.id, titulo: p.titulo, juntaId: j.id, junta: j.titulo, fecha: j.fecha_hora })),
  );
  const acuerdoPorId = new Map(acuerdos.map((a) => [a.id, a]));

  // Los puntos de juntas antiguas no estan en la lista de arriba.
  const faltan = (derramas ?? []).map((d) => d.punto_id).filter((id): id is string => !!id && !acuerdoPorId.has(id));
  if (faltan.length) {
    const { data: puntos } = await supabase
      .from("puntos_del_dia")
      .select("id, titulo, juntas(id, titulo, fecha_hora)")
      .in("id", faltan);
    for (const p of puntos ?? []) {
      if (p.juntas) {
        acuerdoPorId.set(p.id, { id: p.id, titulo: p.titulo, juntaId: p.juntas.id, junta: p.juntas.titulo, fecha: p.juntas.fecha_hora });
      }
    }
  }

  const lista = (derramas ?? []).map((derrama) => {
    const suyos = recibos.filter((r) => r.derrama_id === derrama.id && r.estado !== "anulado");
    const emitido = suyos.reduce((t, r) => t + r.importe, 0);
    const cobrado = suyos.reduce((t, r) => t + cobradoDe(r), 0);
    const pendiente = suyos.reduce((t, r) => t + pendienteDe(r), 0);
    const vencido = suyos
      .filter((r) => r.vence_en && r.vence_en < hoy)
      .reduce((t, r) => t + pendienteDe(r), 0);
    const proximo = suyos
      .filter((r) => pendienteDe(r) > 0 && r.vence_en && r.vence_en >= hoy)
      .map((r) => r.vence_en!)
      .sort()[0];
    return { derrama, emitido, cobrado, pendiente, vencido, proximo, acuerdo: derrama.punto_id ? acuerdoPorId.get(derrama.punto_id) : undefined };
  });

  return (
    <div>
      <CabeceraPagina
        titulo="Derramas"
        icono={Hammer}
        descripcion="Gastos extraordinarios aprobados en junta y cobrados aparte de la cuota"
        accion={editor ? <NuevaDerrama acuerdos={acuerdos} hoy={hoy} /> : undefined}
      />

      <p className="mb-4">
        <Link href="/finanzas" className="text-sm text-suave hover:underline">
          ← Volver a Finanzas
        </Link>
      </p>

      {lista.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borde bg-superficie px-4 py-6 text-center text-sm text-suave">
          No hay derramas.
          {editor && " Cuando la junta apruebe una obra o un gasto extraordinario, créala aquí y la app generará los recibos de cada plazo."}
        </p>
      ) : (
        <ul className="space-y-3">
          {lista.map(({ derrama, emitido, cobrado, pendiente, vencido, proximo, acuerdo }) => {
            const porcentaje = emitido > 0 ? Math.min(100, Math.round((cobrado / emitido) * 100)) : 0;
            const anulada = Boolean(derrama.anulada_en);
            return (
              <li key={derrama.id} id={`derrama-${derrama.id}`} className="tarjeta p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {derrama.titulo}
                      {anulada && <span className="ml-2 rounded-full bg-hundido px-2 py-0.5 text-xs font-medium text-suave">Anulada</span>}
                    </p>
                    <p className="text-sm text-suave">
                      {formatoMoneda(Number(derrama.importe_total))}
                      {derrama.plazos > 1
                        ? ` en ${derrama.plazos} plazos${derrama.meses_entre_plazos > 1 ? ` cada ${derrama.meses_entre_plazos} meses` : " mensuales"}`
                        : " en un pago"}
                      {" · "}primer plazo el {formatoFechaCorta(derrama.primer_vencimiento)}
                    </p>
                    {acuerdo && (
                      <p className="text-sm">
                        Aprobada en{" "}
                        <Link href={`/juntas/${acuerdo.juntaId}`} className="text-principal hover:underline">
                          {acuerdo.junta}
                        </Link>{" "}
                        ({formatoFechaCorta(acuerdo.fecha)}): {acuerdo.titulo}
                      </p>
                    )}
                    {derrama.descripcion && <p className="mt-1 whitespace-pre-line text-sm">{derrama.descripcion}</p>}
                  </div>
                  {editor && !anulada && <AnularDerrama derramaId={derrama.id} />}
                </div>

                {junta && emitido > 0 && (
                  <div className="mt-3">
                    <div className="h-2 overflow-hidden rounded-full bg-hundido" aria-hidden>
                      <div className="h-full rounded-full bg-exito" style={{ width: `${porcentaje}%` }} />
                    </div>
                    <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-suave">
                      <span>
                        Cobrado {formatoMoneda(cobrado)} de {formatoMoneda(emitido)} ({porcentaje} %)
                      </span>
                      {pendiente > 0 && <span>Pendiente {formatoMoneda(pendiente)}</span>}
                      {vencido > 0 && <span className="font-medium text-peligro">Vencido {formatoMoneda(vencido)}</span>}
                      {proximo && <span>Próximo plazo el {formatoFechaCorta(proximo)}</span>}
                    </p>
                  </div>
                )}
                {!junta && pendiente > 0 && (
                  <p className="mt-2 text-sm">
                    Te quedan {formatoMoneda(pendiente)} por pagar.{" "}
                    <Link href="/finanzas/recibos" className="text-principal hover:underline">
                      Ver mis recibos
                    </Link>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-suave">
        Cada plazo genera un recibo por vivienda según su coeficiente, con el concepto «Derrama: …»,
        y se cobra desde Recibos como cualquier otro. Al anular una derrama se anulan los recibos que
        aún no tienen ningún cobro.
      </p>
    </div>
  );
}
