"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { EstadoPresupuesto } from "@/app/acciones/presupuestos";
import { cn } from "@/lib/utilidades";

type Accion = (estado: EstadoPresupuesto, datos: FormData) => Promise<EstadoPresupuesto>;

const ESTADO_INICIAL: EstadoPresupuesto = {};

/**
 * Formulario de una accion del presupuesto: campos ocultos, confirmacion
 * opcional y el error o el mensaje que devuelva el servidor.
 */
export function FormularioAccion({
  accion,
  ocultos,
  children,
  className,
  confirmar,
  reiniciar = false,
}: {
  accion: Accion;
  ocultos?: Record<string, string>;
  children: React.ReactNode;
  className?: string;
  confirmar?: string;
  reiniciar?: boolean;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const [estado, enviar] = useActionState(async (anterior: EstadoPresupuesto, datos: FormData) => {
    const resultado = await accion(anterior, datos);
    if (resultado.ok && reiniciar) formulario.current?.reset();
    return resultado;
  }, ESTADO_INICIAL);

  return (
    <form
      ref={formulario}
      action={enviar}
      className={className}
      onSubmit={(evento) => {
        if (confirmar && !window.confirm(confirmar)) evento.preventDefault();
      }}
    >
      {Object.entries(ocultos ?? {}).map(([nombre, valor]) => (
        <input key={nombre} type="hidden" name={nombre} value={valor} />
      ))}
      {children}
      {estado.error && <p className="w-full text-xs text-peligro">{estado.error}</p>}
      {estado.ok && estado.mensaje && <p className="w-full text-xs text-exito">{estado.mensaje}</p>}
    </form>
  );
}

/** Boton de envio que muestra un indicador mientras se guarda. */
export function BotonEnviar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn("boton", className)}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
