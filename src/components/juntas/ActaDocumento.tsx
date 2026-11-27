import type { DatosActa } from "@/lib/datos-acta";
import { formatoCoeficienteVoto, MAYORIAS, SENTIDOS } from "@/lib/votaciones";

const FECHA_LARGA = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
});
const HORA = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
const FECHA = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const ESTADOS = {
  aprobado: "Queda aprobado",
  pendiente: "Queda aprobado por los presentes, a falta de que los ausentes no se opongan en 30 días naturales desde la notificación del acta (art. 17.8 LPH)",
  rechazado: "No se aprueba",
  sin_votos: null,
} as const;

function fechaCorta(iso: string) {
  return FECHA.format(new Date(`${iso}T00:00:00Z`));
}

/**
 * Acta de una junta con el contenido minimo del art. 19.2 LPH. Se usa en la
 * pagina del acta y en el libro de actas.
 */
export function ActaDocumento({
  datos,
  comunidad,
}: {
  datos: DatosActa;
  comunidad: { nombre: string; direccion: string | null; ciudad: string | null; codigo_postal: string | null; cif: string | null };
}) {
  const { junta, asistentes, quorum, puntos, morosos, presidente, secretario } = datos;
  const inicio = new Date(junta.fecha_hora);
  const segunda = new Date(inicio.getTime() + junta.segunda_convocatoria_minutos * 60_000);
  const horaInicio = junta.convocatoria_celebrada === 2 ? segunda : inicio;
  const direccion = [comunidad.direccion, [comunidad.codigo_postal, comunidad.ciudad].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return (
    <article className="tarjeta space-y-5 p-6 text-[15px] leading-relaxed sm:p-10 print:border-0 print:p-0 print:shadow-none">
      <header className="border-b border-borde pb-4">
        <p className="font-titulo text-lg font-semibold">Comunidad de Propietarios {comunidad.nombre}</p>
        {direccion && <p className="text-sm text-suave">{direccion}</p>}
        {comunidad.cif && <p className="text-sm text-suave">CIF {comunidad.cif}</p>}
      </header>

      <h2 className="text-center text-xl font-semibold uppercase tracking-wide">
        Acta de la junta general {junta.tipo}
      </h2>

      <p>
        {comunidad.ciudad ? `En ${comunidad.ciudad}, ` : ""}el {FECHA_LARGA.format(inicio)}, a las{" "}
        {HORA.format(horaInicio)}
        {junta.lugar ? `, en ${junta.lugar},` : ","} se reúne la junta general {junta.tipo} de la
        Comunidad de Propietarios {comunidad.nombre}
        {junta.convocatoria_celebrada
          ? `, en ${junta.convocatoria_celebrada === 1 ? "primera" : "segunda"} convocatoria`
          : ""}
        , convocada por {presidente ? `el presidente, ${presidente}` : "la presidencia de la comunidad"}, con
        el orden del día que se recoge más abajo.
      </p>

      <section>
        <h3 className="mb-2 font-semibold">Asistentes</h3>
        {asistentes.length === 0 ? (
          <p className="text-suave">No se registró la asistencia.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borde text-left text-suave">
                  <th className="py-1 pr-2 font-medium">Vivienda</th>
                  <th className="py-1 pr-2 font-medium">Propietarios</th>
                  <th className="py-1 pr-2 font-medium">Asiste</th>
                  <th className="py-1 text-right font-medium">Cuota</th>
                </tr>
              </thead>
              <tbody>
                {asistentes.map((v) => (
                  <tr key={v.fincaId} className="border-b border-borde/60 align-top">
                    <td className="py-1 pr-2 font-medium">{v.codigo}</td>
                    <td className="py-1 pr-2">{v.titulares || "—"}</td>
                    <td className="py-1 pr-2">
                      {v.modo === "presencial" ? "En persona" : `Representada${v.representante ? ` por ${v.representante}` : ""}`}
                      {v.sinVoto && " (sin voto, art. 15.2)"}
                    </td>
                    <td className="py-1 text-right tabular-nums">{formatoCoeficienteVoto(v.coeficiente)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-sm">
              Asisten {quorum.presentes} {quorum.presentes === 1 ? "vivienda" : "viviendas"} en persona y{" "}
              {quorum.representadas} {quorum.representadas === 1 ? "representada" : "representadas"}, de un total de {quorum.total}, que suman el{" "}
              {formatoCoeficienteVoto(quorum.porcentaje)} de las cuotas de participación.
            </p>
          </>
        )}
        {morosos.length > 0 && (
          <p className="mt-2 text-sm">
            No están al corriente de pago y no pueden votar (art. 15.2 LPH):{" "}
            {morosos.map((m) => m.codigo).join(", ")}.
          </p>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-semibold">Orden del día y acuerdos</h3>
        {puntos.length === 0 ? (
          <p className="text-suave">Sin puntos en el orden del día.</p>
        ) : (
          <ol className="list-decimal space-y-4 pl-6">
            {puntos.map((punto) => (
              <li key={punto.id}>
                <p className="font-medium">{punto.titulo}</p>
                {punto.resultado && <p className="mt-1 whitespace-pre-line">{punto.resultado}</p>}
                {punto.votacion && punto.votacion.estado !== "sin_votos" && (
                  <div className="mt-1 text-sm">
                    <p>
                      Votación ({MAYORIAS[punto.mayoria].toLowerCase()}):{" "}
                      {(["favor", "contra", "abstencion"] as const)
                        .map((sentido) => {
                          const recuento = punto.votacion![sentido];
                          return `${SENTIDOS[sentido].toLowerCase()}, ${recuento.viviendas} (${formatoCoeficienteVoto(recuento.coeficiente)})`;
                        })
                        .join("; ")}
                      .
                    </p>
                    <p className="font-medium">{ESTADOS[punto.votacion.estado]}.</p>
                    {punto.contrarios.length > 0 && (
                      <p>Votan en contra: {punto.contrarios.join("; ")}.</p>
                    )}
                  </div>
                )}
                {!punto.resultado && (!punto.votacion || punto.votacion.estado === "sin_votos") && (
                  <p className="mt-1 text-sm text-suave">Sin acuerdo anotado.</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {junta.acta_texto && (
        <section>
          <h3 className="mb-2 font-semibold">Desarrollo de la sesión</h3>
          <p className="whitespace-pre-line">{junta.acta_texto}</p>
        </section>
      )}

      <p>
        Y sin más asuntos que tratar, se levanta la sesión, de la que se extiende la presente acta
        {junta.acta_firmada_en ? `, cerrada y firmada el ${fechaCorta(junta.acta_firmada_en)}` : ""}.
      </p>

      <div className="grid grid-cols-2 gap-8 pt-10 text-sm print:break-inside-avoid">
        <div>
          <p className="border-t border-borde-fuerte pt-2">El presidente</p>
          {presidente && <p className="text-suave">{presidente}</p>}
        </div>
        <div>
          <p className="border-t border-borde-fuerte pt-2">El secretario</p>
          {secretario && <p className="text-suave">{secretario}</p>}
        </div>
      </div>
    </article>
  );
}
