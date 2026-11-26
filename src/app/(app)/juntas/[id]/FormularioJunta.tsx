"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2 } from "lucide-react";
import type { EstadoJunta } from "@/app/acciones/juntas";
import { cn } from "@/lib/utilidades";

type Accion = (estado: EstadoJunta, datos: FormData) => Promise<EstadoJunta>;

const ESTADO_INICIAL: EstadoJunta = {};

/**
 * Formulario de una acción de la junta. Envía `junta_id` y los campos que
 * lleve dentro, y muestra el error o un aviso breve de guardado.
 */
export function FormularioJunta({
  accion,
  juntaId,
  children,
  className,
  boton,
  claseBoton = "boton boton-principal",
  confirmar,
  reiniciar = false,
  ocultos,
}: {
  accion: Accion;
  juntaId: string;
  children?: React.ReactNode;
  className?: string;
  boton?: React.ReactNode;
  claseBoton?: string;
  confirmar?: string;
  reiniciar?: boolean;
  ocultos?: Record<string, string>;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const [guardado, setGuardado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [estado, enviar] = useActionState(async (anterior: EstadoJunta, datos: FormData) => {
    const resultado = await accion(anterior, datos);
    if (resultado.ok) {
      if (reiniciar) formulario.current?.reset();
      setGuardado(true);
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setGuardado(false), 2500);
    }
    return resultado;
  }, ESTADO_INICIAL);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  return (
    <form
      ref={formulario}
      action={enviar}
      className={className}
      onSubmit={(evento) => {
        if (confirmar && !window.confirm(confirmar)) evento.preventDefault();
      }}
    >
      <input type="hidden" name="junta_id" value={juntaId} />
      {ocultos &&
        Object.entries(ocultos).map(([nombre, valor]) => (
          <input key={nombre} type="hidden" name={nombre} value={valor} />
        ))}
      {children}
      {estado.error && <p className="aviso aviso-error mt-3">{estado.error}</p>}
      {boton && (
        <div className="mt-3 flex items-center gap-3">
          <BotonEnviar className={claseBoton}>{boton}</BotonEnviar>
          {guardado && (
            <span className="flex items-center gap-1 text-sm text-exito" role="status">
              <Check className="size-4" aria-hidden />
              Guardado
            </span>
          )}
        </div>
      )}
    </form>
  );
}

/** Botón que muestra un indicador mientras se envía el formulario. */
export function BotonEnviar({
  children,
  className,
  etiqueta,
  nombre,
  valor,
}: {
  children: React.ReactNode;
  className?: string;
  etiqueta?: string;
  nombre?: string;
  valor?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={nombre}
      value={valor}
      disabled={pending}
      aria-label={etiqueta}
      title={etiqueta}
      className={cn(className, pending && "opacity-70")}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
