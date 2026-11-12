"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { cambiarEstadoIncidencia } from "@/app/acciones/incidencias";

const ESTADOS = [
  { valor: "abierta", texto: "Abierta" },
  { valor: "en_curso", texto: "En curso" },
  { valor: "resuelta", texto: "Resuelta" },
  { valor: "cerrada", texto: "Cerrada" },
];

/** Estados que piden un comentario de seguimiento al cambiarlos. */
const PIDE_COMENTARIO = new Set(["resuelta", "cerrada"]);

export function SelectorEstado({ id, estado }: { id: string; estado: string }) {
  const [pendiente, iniciar] = useTransition();
  const [cambioLocal, setCambioLocal] = useState<{
    desde: string;
    hacia: string;
  } | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState<string | null>(null);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string>();

  // El valor que se muestra es el del servidor; el cambio local solo cubre el
  // hueco hasta que la revalidacion actualiza `estado`.
  const valor = cambioLocal?.desde === estado ? cambioLocal.hacia : estado;

  useEffect(() => {
    if (!nuevoEstado) return;
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && !pendiente) setNuevoEstado(null);
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [nuevoEstado, pendiente]);

  function guardar(destino: string, texto: string) {
    setError(undefined);
    iniciar(async () => {
      const resultado = await cambiarEstadoIncidencia(id, destino, texto);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setCambioLocal({ desde: estado, hacia: destino });
      setNuevoEstado(null);
      setComentario("");
    });
  }

  function alCambiar(destino: string) {
    setError(undefined);

    if (PIDE_COMENTARIO.has(destino)) {
      setNuevoEstado(destino);
      setComentario("");
      return;
    }

    guardar(destino, "");
  }

  const textoEstado =
    ESTADOS.find((opcion) => opcion.valor === nuevoEstado)?.texto ?? "";

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-2">
        <select
          value={valor}
          disabled={pendiente}
          onChange={(evento) => alCambiar(evento.target.value)}
          className="rounded-lg border border-borde bg-white px-2 py-1 text-xs font-medium"
          aria-label="Cambiar estado"
        >
          {ESTADOS.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.texto}
            </option>
          ))}
        </select>
        {pendiente && <Loader2 className="size-3.5 animate-spin text-suave" aria-hidden />}
      </span>

      {error && !nuevoEstado && (
        <span className="max-w-52 text-right text-[11px] font-medium text-red-700">{error}</span>
      )}

      {nuevoEstado && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`titulo-estado-${id}`}
        >
          <div className="w-full max-w-md rounded-2xl border border-borde bg-superficie p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={`titulo-estado-${id}`} className="text-base font-bold">
                  {textoEstado === "Resuelta" ? "Marcar como resuelta" : "Cerrar incidencia"}
                </h2>
                <p className="mt-1 text-sm text-suave">
                  Puedes dejar un comentario con lo que se ha hecho. Lo verán todos los vecinos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNuevoEstado(null)}
                disabled={pendiente}
                className="rounded-lg p-1.5 text-suave hover:bg-fondo"
                aria-label="Cerrar"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <form
              className="mt-4"
              onSubmit={(evento) => {
                evento.preventDefault();
                guardar(nuevoEstado, comentario);
              }}
            >
              <label htmlFor={`comentario-${id}`} className="etiqueta">
                Comentario (opcional)
              </label>
              <textarea
                id={`comentario-${id}`}
                value={comentario}
                onChange={(evento) => setComentario(evento.target.value)}
                rows={3}
                maxLength={600}
                autoFocus
                placeholder={
                  textoEstado === "Resuelta"
                    ? "Por ejemplo: el fontanero ha cambiado la válvula."
                    : "Por ejemplo: tema cerrado tras la reunión del martes."
                }
                className="campo resize-y"
              />
              <p className="mt-1 text-right text-xs text-suave">{comentario.length}/600</p>

              {error && (
                <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNuevoEstado(null)}
                  disabled={pendiente}
                  className="boton boton-borde"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={pendiente} className="boton boton-principal">
                  {pendiente ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="size-4" aria-hidden />
                  )}
                  {pendiente ? "Guardando…" : `Marcar como ${textoEstado.toLowerCase()}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </span>
  );
}
