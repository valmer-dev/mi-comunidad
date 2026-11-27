import { requerirContexto } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/**
 * Descarga en JSON de los datos personales de quien la pide (derecho de
 * acceso y portabilidad, art. 15 y 20 RGPD). Usa el cliente del propio
 * usuario, asi que solo sale lo que la seguridad de la base le deja ver.
 */
export async function GET() {
  const { usuario, comunidad } = await requerirContexto();
  const supabase = await crearClienteServidor();

  const [{ data: perfil }, { data: miembros }, { data: titulares }] = await Promise.all([
    supabase
      .from("perfiles")
      .select("nombre, apellidos, telefono, correo, domicilio_notificaciones, avisos_correo, creado_en, privacidad_vista_en")
      .eq("id", usuario.id)
      .maybeSingle(),
    supabase.from("miembros").select("rol, estado, creado_en, comunidades(nombre)").eq("usuario_id", usuario.id),
    supabase
      .from("titulares")
      .select("finca_id, tipo, porcentaje, desde, hasta, fincas(codigo, coeficiente, comunidad_id)")
      .eq("usuario_id", usuario.id),
  ]);

  const fincas = (titulares ?? [])
    .filter((t) => t.fincas?.comunidad_id === comunidad.id)
    .map((t) => t.finca_id);

  const [
    { data: recibos },
    { data: certificados },
    { data: incidencias },
    { data: asistencias },
    { data: votos },
    { data: notificaciones },
  ] = await Promise.all([
    fincas.length
      ? supabase
          .from("recibos")
          .select("periodo, concepto, importe, vence_en, estado, fincas(codigo), pagos(fecha, importe, metodo)")
          .in("finca_id", fincas)
          .order("periodo")
      : Promise.resolve({ data: [] }),
    fincas.length
      ? supabase
          .from("certificados_deuda")
          .select("numero, solicitante, solicitado_en, emitido_en, deuda_total")
          .in("finca_id", fincas)
      : Promise.resolve({ data: [] }),
    supabase
      .from("incidencias")
      .select("titulo, descripcion, estado, creado_en")
      .eq("comunidad_id", comunidad.id)
      .eq("reportado_por", usuario.id),
    supabase.from("asistencias").select("modo, coeficiente, representante_nombre, juntas(titulo, fecha_hora)").eq("usuario_id", usuario.id),
    fincas.length
      ? supabase.from("votos").select("sentido, ausente, coeficiente, puntos_del_dia(titulo)").in("finca_id", fincas)
      : Promise.resolve({ data: [] }),
    supabase
      .from("notificaciones")
      .select("titulo, creado_en, leida_en")
      .eq("usuario_id", usuario.id)
      .order("creado_en"),
  ]);

  const datos = {
    generado_en: new Date().toISOString(),
    responsable: `Comunidad de Propietarios ${comunidad.nombre}`,
    perfil,
    comunidades: miembros,
    viviendas: titulares,
    recibos,
    certificados_deuda: certificados,
    incidencias_comunicadas: incidencias,
    asistencias_a_juntas: asistencias,
    votos_de_tus_viviendas: votos,
    avisos: notificaciones,
  };

  const fecha = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(datos, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mis-datos-${fecha}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
