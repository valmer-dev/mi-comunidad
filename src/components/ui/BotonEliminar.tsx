"use client";

import { useActionState } from "react";
import { Loader2, Trash2 } from "lucide-react";

export type EstadoEliminar = { error?: string; ok?: boolean };

type AccionEliminar = (
  estado: EstadoEliminar,
  datos: FormData,
) => Promise<EstadoEliminar>;

const ESTADO_INICIAL: EstadoEliminar = {};

type Props = {
  accion: AccionEliminar;
  id: string;
  mensaje: string;
  etiqueta?: string;
  titulo?: string;
};

/**
 * Botón de borrado con confirmación. Se usa en el tablón, incidencias, juntas
 * y documentos. El servidor vuelve a comprobar el permiso.
 */
export function BotonEliminar({
  accion,
  id,
  mensaje,
  etiqueta = "Eliminar",
  titulo,
}: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form
      action={enviar}
      onSubmit={(evento) => {
        if (!window.confirm(mensaje)) evento.preventDefault();
      }}
      className="inline-flex flex-col items-start gap-1"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pendiente}
        title={titulo ?? etiqueta}
        className="boton px-3 py-1.5 text-xs boton-peligro"
      >
        {pendiente ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Trash2 className="size-3.5" aria-hidden />
        )}
        {etiqueta}
      </button>
      {estado.error && (
        <p className="max-w-[240px] text-xs text-peligro">{estado.error}</p>
      )}
    </form>
  );
}
