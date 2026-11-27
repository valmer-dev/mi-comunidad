import Link from "next/link";
import { AlertTriangle, Briefcase } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador, puedeEditarFinanzas, puedeVerFinanzas } from "@/lib/permisos";
import { estadoContrato, estadoSeguro } from "@/lib/proveedores";
import { hoyISO } from "@/lib/recibos";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { CabeceraPagina, EstadoVacio } from "@/components/ui/CabeceraPagina";
import { NuevoServicio } from "./NuevoServicio";
import { ServicioItem, type FichaJunta, type GastoServicio } from "./ServicioItem";

export const metadata = { title: "Servicios" };

const FECHA = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "UTC" });

export default async function PaginaServicios() {
  const { comunidad, permisos, miembro, esAdminPlataforma } = await requerirContexto();
  const supabase = await crearClienteServidor();
  const puedeGestionar = esAdministrador(permisos) || puedeEditarFinanzas(miembro.rol, esAdminPlataforma);
  const junta = puedeGestionar || puedeVerFinanzas(permisos);
  const hoy = hoyISO();
  const anio = hoy.slice(0, 4);

  const [{ data: servicios }, { data: gastos }, { data: documentos }] = await Promise.all([
    supabase
      .from("proveedores")
      .select(
        "id, nombre, categoria, telefono, cif, persona_contacto, correo, contrato_inicio, contrato_fin, renovacion_automatica, preaviso_dias, importe_anual, seguro_hasta, contrato_documento_id, notas",
      )
      .eq("comunidad_id", comunidad.id)
      .order("categoria", { ascending: true, nullsFirst: false })
      .order("nombre", { ascending: true }),
    junta
      ? supabase
          .from("gastos")
          .select("id, proveedor_id, concepto, fecha, total")
          .eq("comunidad_id", comunidad.id)
          .not("proveedor_id", "is", null)
          .order("fecha", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; proveedor_id: string | null; concepto: string; fecha: string; total: number }[] }),
    puedeGestionar
      ? supabase
          .from("documentos")
          .select("id, nombre, ruta_almacenamiento, carpeta")
          .eq("comunidad_id", comunidad.id)
          .order("creado_en", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; nombre: string; ruta_almacenamiento: string | null; carpeta: string }[] }),
  ]);

  const lista = servicios ?? [];
  const documentosContrato = (documentos ?? [])
    .filter((d) => d.carpeta === "Contratos" || lista.some((s) => s.contrato_documento_id === d.id))
    .map((d) => ({ id: d.id, nombre: d.nombre }));

  // Enlaces firmados a los PDF de los contratos, solo para la junta.
  const enlaces = new Map<string, string>();
  const idsContrato = lista.map((s) => s.contrato_documento_id).filter((id): id is string => !!id);
  if (junta && idsContrato.length) {
    const { data: filas } = await supabase
      .from("documentos")
      .select("id, ruta_almacenamiento")
      .in("id", idsContrato);
    const rutas = (filas ?? []).filter((f) => f.ruta_almacenamiento);
    if (rutas.length) {
      const { data: firmadas } = await crearClienteAdmin()
        .storage.from("documentos")
        .createSignedUrls(rutas.map((f) => f.ruta_almacenamiento!), 60 * 60);
      rutas.forEach((f, i) => {
        const url = firmadas?.[i]?.signedUrl;
        if (url) enlaces.set(f.id, url);
      });
    }
  }

  const gastosPorProveedor = new Map<string, GastoServicio[]>();
  for (const g of gastos ?? []) {
    if (!g.proveedor_id) continue;
    gastosPorProveedor.set(g.proveedor_id, [
      ...(gastosPorProveedor.get(g.proveedor_id) ?? []),
      { id: g.id, concepto: g.concepto, fecha: g.fecha, total: Number(g.total) },
    ]);
  }

  const fichas = new Map<string, FichaJunta>();
  if (junta) {
    for (const s of lista) {
      const suyos = gastosPorProveedor.get(s.id) ?? [];
      fichas.set(s.id, {
        contrato: estadoContrato(s.contrato_fin, s.preaviso_dias, hoy),
        seguro: estadoSeguro(s.seguro_hasta, hoy),
        enlaceContrato: s.contrato_documento_id ? enlaces.get(s.contrato_documento_id) ?? null : null,
        gastadoAnio: suyos.filter((g) => g.fecha.startsWith(anio)).reduce((t, g) => t + g.total, 0),
        gastadoTotal: suyos.reduce((t, g) => t + g.total, 0),
        ultimosGastos: suyos.slice(0, 10),
      });
    }
  }

  const avisos = lista.flatMap((s) => {
    const ficha = fichas.get(s.id);
    if (!ficha) return [];
    const nombre = `${s.categoria || "Servicio"} (${s.nombre})`;
    const out: { id: string; texto: string; grave: boolean }[] = [];
    if (ficha.contrato.tipo === "vencido") {
      out.push({ id: `${s.id}-c`, texto: `El contrato de ${nombre} venció el ${FECHA.format(new Date(`${ficha.contrato.fin}T00:00:00Z`))}.`, grave: true });
    } else if (ficha.contrato.tipo === "proximo") {
      const limite = ficha.contrato.limitePreaviso;
      out.push({
        id: `${s.id}-c`,
        texto: `El contrato de ${nombre} vence el ${FECHA.format(new Date(`${ficha.contrato.fin}T00:00:00Z`))}${
          limite ? `; para no renovarlo hay que avisar antes del ${FECHA.format(new Date(`${limite}T00:00:00Z`))}` : ""
        }.`,
        grave: Boolean(limite && limite < hoy),
      });
    }
    if (ficha.seguro.tipo === "vencido") {
      out.push({ id: `${s.id}-s`, texto: `El seguro de ${nombre} está vencido: pide el nuevo certificado.`, grave: true });
    } else if (ficha.seguro.tipo === "proximo") {
      out.push({ id: `${s.id}-s`, texto: `El seguro de ${nombre} vence el ${FECHA.format(new Date(`${ficha.seguro.fin}T00:00:00Z`))}.`, grave: false });
    }
    return out;
  });

  return (
    <div>
      <CabeceraPagina
        titulo="Servicios"
        icono={Briefcase}
        descripcion={
          junta
            ? "Proveedores de la comunidad, sus contratos, vencimientos y lo que se les ha pagado"
            : "Empresas contratadas por la comunidad y sus teléfonos de contacto"
        }
        accion={puedeGestionar ? <NuevoServicio documentos={documentosContrato} /> : undefined}
      />

      {avisos.length > 0 && (
        <section className="tarjeta mb-4 border-atencion/40 p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 text-atencion" aria-hidden />
            Vencimientos próximos
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {avisos.map((a) => (
              <li key={a.id} className={a.grave ? "font-medium text-peligro" : undefined}>
                {a.texto}
              </li>
            ))}
          </ul>
        </section>
      )}

      {lista.length > 0 ? (
        <ul className="space-y-3">
          {lista.map((servicio) => (
            <ServicioItem
              key={servicio.id}
              servicio={{ ...servicio, importe_anual: servicio.importe_anual == null ? null : Number(servicio.importe_anual) }}
              puedeGestionar={puedeGestionar}
              documentos={documentosContrato}
              ficha={fichas.get(servicio.id) ?? null}
            />
          ))}
        </ul>
      ) : (
        <EstadoVacio
          titulo="Todavía no hay servicios registrados"
          descripcion={
            puedeGestionar
              ? "Añade las empresas de mantenimiento, administración, limpieza y demás servicios contratados."
              : "La junta todavía no ha registrado las empresas de mantenimiento y administración."
          }
          accion={<Briefcase className="size-9 text-principal/40" aria-hidden />}
        />
      )}

      {junta && (
        <p className="mt-4 text-xs text-suave">
          El gasto de cada proveedor sale de los gastos de{" "}
          <Link href="/finanzas" className="text-principal hover:underline">
            Finanzas
          </Link>{" "}
          que tienen ese proveedor. Los vecinos solo ven el servicio, la empresa y cómo contactar.
        </p>
      )}
    </div>
  );
}
