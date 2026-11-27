import { CheckCircle2, Clock, MinusCircle, XCircle } from "lucide-react";
import {
  formatoCoeficienteVoto,
  type Mayoria,
  type Recuento,
  type ResultadoVotacion as Resultado,
} from "@/lib/votaciones";
import { formatoFecha } from "@/lib/utilidades";
import { cn } from "@/lib/utilidades";

function recuento(texto: string, valor: Recuento) {
  return `${texto} ${valor.viviendas} (${formatoCoeficienteVoto(valor.coeficiente)})`;
}

function necesario(mayoria: Mayoria, base: Recuento) {
  const total = `${base.viviendas} ${base.viviendas === 1 ? "vivienda" : "viviendas"} y ${formatoCoeficienteVoto(base.coeficiente)} de cuota`;
  switch (mayoria) {
    case "simple":
      return `Hace falta más de la mitad de los presentes con voto: ${total}.`;
    case "doble":
      return `Hace falta más de la mitad del total con voto: ${total}.`;
    case "tres_quintos":
      return `Hacen falta tres quintos del total con voto: ${total}.`;
    case "unanimidad":
      return `Hace falta el voto a favor de todos: ${total}.`;
  }
}

/** Resultado calculado de un punto, con los que votaron en contra. */
export function ResultadoVotacion({
  mayoria,
  resultado,
  contrarios,
  finPlazo,
}: {
  mayoria: Mayoria;
  resultado: Resultado;
  contrarios: string[];
  finPlazo: string | null;
}) {
  const { estado } = resultado;
  const aspecto = {
    aprobado: { icono: CheckCircle2, clase: "bg-exito-claro text-exito", texto: "Aprobado" },
    pendiente: {
      icono: Clock,
      clase: "bg-atencion-claro text-tinta",
      texto: finPlazo
        ? `Aprobado si los ausentes no se oponen hasta el ${formatoFecha(finPlazo)}`
        : "Pendiente de los ausentes",
    },
    rechazado: { icono: XCircle, clase: "bg-peligro-claro text-peligro", texto: "No aprobado" },
    sin_votos: { icono: MinusCircle, clase: "bg-hundido text-suave", texto: "Sin votos anotados" },
  }[estado];
  const Icono = aspecto.icono;

  return (
    <div className="mt-2 space-y-1 text-xs">
      <span className={cn("chip", aspecto.clase)}>
        <Icono className="size-3.5" aria-hidden />
        {aspecto.texto}
      </span>
      {estado !== "sin_votos" && (
        <p className="text-suave">
          {[
            recuento("A favor", resultado.favor),
            recuento("En contra", resultado.contra),
            recuento("Abstenciones", resultado.abstencion),
          ].join(" · ")}
          {resultado.sinVotar.viviendas > 0 && ` · Sin votar ${resultado.sinVotar.viviendas}`}
        </p>
      )}
      <p className="text-suave">{necesario(mayoria, resultado.base)}</p>
      {estado === "pendiente" && (
        <p className="text-suave">
          {resultado.ausentesSinRespuesta.viviendas}{" "}
          {resultado.ausentesSinRespuesta.viviendas === 1 ? "vivienda ausente no ha" : "viviendas ausentes no han"}{" "}
          respondido. Si no se oponen en 30 días naturales desde que se les notifica el acta,
          cuentan a favor (art. 17.8 LPH).
          {!finPlazo && " Anota la fecha de notificación del acta para calcular el plazo."}
        </p>
      )}
      {contrarios.length > 0 && (
        <p>
          <span className="font-semibold">Votaron en contra:</span> {contrarios.join("; ")}
        </p>
      )}
    </div>
  );
}
