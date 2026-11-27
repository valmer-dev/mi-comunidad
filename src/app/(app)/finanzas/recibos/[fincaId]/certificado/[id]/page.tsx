import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import type { LineaDeuda } from "@/lib/certificados";
import { formatoCoeficiente } from "@/lib/coeficientes";
import { nombrePeriodo } from "@/lib/recibos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatoMoneda } from "@/lib/utilidades";
import { BotonImprimir } from "@/components/ui/BotonImprimir";
import { cargarFincas } from "../../../datos";

export const metadata = { title: "Certificado de deuda" };

const FECHA = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const fecha = (iso: string) => FECHA.format(new Date(`${iso}T00:00:00Z`));

/**
 * Certificado de deuda de una vivienda (art. 9.1.e LPH), listo para imprimir
 * y firmar por el secretario con el visto bueno del presidente.
 */
export default async function PaginaCertificado(props: PageProps<"/finanzas/recibos/[fincaId]/certificado/[id]">) {
  const { fincaId, id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(fincaId) || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { comunidad } = await requerirContexto();
  const supabase = await crearClienteServidor();

  const [{ data: certificado }, fincas, { data: cargos }] = await Promise.all([
    supabase
      .from("certificados_deuda")
      .select("id, numero, solicitante, motivo, solicitado_en, emitido_en, deuda_total, deuda_vencida, deuda_afecta, detalle")
      .eq("id", id)
      .eq("finca_id", fincaId)
      .eq("comunidad_id", comunidad.id)
      .maybeSingle(),
    cargarFincas(supabase, comunidad.id),
    supabase
      .from("miembros")
      .select("rol, perfiles(nombre, apellidos)")
      .eq("comunidad_id", comunidad.id)
      .eq("estado", "activo")
      .in("rol", ["presidente", "secretario"]),
  ]);
  // Lo puede ver la junta o el titular; si no, la consulta no devuelve nada.
  if (!certificado || !certificado.emitido_en) notFound();
  const finca = fincas.find((f) => f.id === fincaId);
  if (!finca) notFound();

  const nombre = (rol: string) => {
    const perfil = cargos?.find((c) => c.rol === rol)?.perfiles;
    return [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(" ") || null;
  };
  const presidente = nombre("presidente");
  const secretario = nombre("secretario");
  // Sin secretario, sus funciones las hace el presidente (art. 13.6 LPH).
  const firmante = secretario
    ? { cargo: "secretario", nombre: secretario }
    : { cargo: "presidente, en funciones de secretario", nombre: presidente };

  const detalle = (Array.isArray(certificado.detalle) ? certificado.detalle : []) as LineaDeuda[];
  const total = Number(certificado.deuda_total ?? 0);
  const vencida = Number(certificado.deuda_vencida ?? 0);
  const afecta = Number(certificado.deuda_afecta ?? 0);
  const direccion = [comunidad.direccion, [comunidad.codigo_postal, comunidad.ciudad].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const anioEmision = Number(certificado.emitido_en.slice(0, 4));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-imprimir mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/finanzas/recibos/${finca.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-principal">
          <ArrowLeft className="size-4" aria-hidden />
          {finca.codigo}
        </Link>
        <BotonImprimir />
      </div>

      <article className="tarjeta space-y-5 p-6 text-[15px] leading-relaxed sm:p-10 print:border-0 print:p-0 print:shadow-none">
        <header className="border-b border-borde pb-4">
          <p className="font-titulo text-lg font-semibold">Comunidad de Propietarios {comunidad.nombre}</p>
          {direccion && <p className="text-sm text-suave">{direccion}</p>}
          {comunidad.cif && <p className="text-sm text-suave">CIF {comunidad.cif}</p>}
        </header>

        <div className="text-center">
          <h1 className="text-xl font-semibold uppercase tracking-wide">Certificado de deuda</h1>
          <p className="text-sm text-suave">
            Nº {certificado.numero}/{anioEmision}
          </p>
        </div>

        <p>
          {firmante.nombre ? `${firmante.nombre}, ` : ""}
          {firmante.cargo} de la Comunidad de Propietarios {comunidad.nombre}
          {secretario && presidente ? `, con el visto bueno del presidente, ${presidente},` : ""}
        </p>

        <p className="font-semibold">CERTIFICA:</p>

        <p>
          Que la finca <strong>{finca.codigo}</strong>
          {finca.coeficiente > 0 && `, con una cuota de participación del ${formatoCoeficiente(finca.coeficiente)} %`}
          {finca.titulares.length > 0 && `, cuyo titular es ${finca.titulares.join(", ")}`}, a fecha de{" "}
          {fecha(certificado.emitido_en)},{" "}
          {total === 0 ? (
            <strong>se encuentra al corriente en el pago de las cuotas y derramas de la comunidad.</strong>
          ) : (
            <>
              adeuda a la comunidad la cantidad de <strong>{formatoMoneda(total)}</strong>
              {vencida < total && `, de la que ${formatoMoneda(vencida)} está vencida`}, según el detalle siguiente:
            </>
          )}
        </p>

        {detalle.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-suave">
                <th className="py-1 pr-2 font-medium">Periodo</th>
                <th className="py-1 pr-2 font-medium">Concepto</th>
                <th className="py-1 pr-2 font-medium">Vence</th>
                <th className="py-1 text-right font-medium">Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {detalle.map((linea, i) => (
                <tr key={i} className="border-b border-borde/60">
                  <td className="py-1 pr-2 capitalize">{nombrePeriodo(linea.periodo)}</td>
                  <td className="py-1 pr-2">{linea.concepto}</td>
                  <td className="py-1 pr-2">{linea.vence_en ? fecha(linea.vence_en) : "—"}</td>
                  <td className="py-1 text-right tabular-nums">{formatoMoneda(linea.pendiente)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="py-1 pr-2 text-right font-medium">
                  Total
                </td>
                <td className="py-1 text-right font-semibold tabular-nums">{formatoMoneda(total)}</td>
              </tr>
            </tbody>
          </table>
        )}

        {total > 0 && (
          <p className="text-sm">
            De esta cantidad, {formatoMoneda(afecta)} corresponden a la parte vencida de la anualidad en curso y de
            los tres años naturales anteriores ({anioEmision - 3} a {anioEmision}), de la que responde la propia
            vivienda aunque cambie de propietario (art. 9.1.e de la Ley de Propiedad Horizontal).
          </p>
        )}

        <p>
          Y para que conste, a petición de {certificado.solicitante}
          {certificado.motivo === "compraventa" ? ", a efectos de la transmisión de la vivienda (art. 9.1.e LPH)" : ""}, se
          expide el presente certificado{comunidad.ciudad ? ` en ${comunidad.ciudad}` : ""} el {fecha(certificado.emitido_en)}.
          No incluye cantidades que se generen después de esta fecha.
        </p>

        <div className="grid grid-cols-2 gap-8 pt-10 text-sm print:break-inside-avoid">
          <div>
            <p className="border-t border-borde-fuerte pt-2 first-letter:uppercase">El {firmante.cargo}</p>
            {firmante.nombre && <p className="text-suave">{firmante.nombre}</p>}
          </div>
          {secretario && (
            <div>
              <p className="border-t border-borde-fuerte pt-2">Vº Bº El presidente</p>
              {presidente && <p className="text-suave">{presidente}</p>}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
