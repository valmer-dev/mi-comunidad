"use client";

import { useActionState } from "react";
import { Loader2, Mail } from "lucide-react";
import { guardarContacto, type EstadoContacto } from "@/app/acciones/notificaciones";

const ESTADO_INICIAL: EstadoContacto = {};

/**
 * Correo real y domicilio a efectos de notificaciones (art. 9.1.h LPH).
 * No cambia cómo se entra en la app: se sigue entrando con el teléfono o el
 * correo de siempre.
 */
export function DatosContacto({
  correo,
  domicilio,
  avisosCorreo,
}: {
  correo: string;
  domicilio: string;
  avisosCorreo: boolean;
}) {
  const [estado, accion, pendiente] = useActionState(guardarContacto, ESTADO_INICIAL);

  return (
    <form action={accion} id="contacto" className="mt-5 scroll-mt-24 border-t border-borde pt-5">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <Mail className="size-4 text-principal" aria-hidden />
        Datos para notificaciones
      </h3>
      <p className="mt-1 text-xs text-suave">
        La comunidad te enviará aquí las convocatorias, las actas y los recibos. Para
        entrar en la app sigues usando tu teléfono o tu correo de siempre.
      </p>

      <div className="mt-3 grid gap-3">
        <div>
          <label htmlFor="correo-contacto" className="etiqueta">
            Correo electrónico
          </label>
          <input
            id="correo-contacto"
            name="correo"
            type="email"
            autoComplete="email"
            defaultValue={correo}
            placeholder="nombre@correo.com"
            className="campo"
          />
        </div>
        <div>
          <label htmlFor="domicilio-contacto" className="etiqueta">
            Domicilio para notificaciones
          </label>
          <input
            id="domicilio-contacto"
            name="domicilio"
            autoComplete="street-address"
            defaultValue={domicilio}
            placeholder="Solo si no vives en la comunidad"
            className="campo"
          />
        </div>
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="avisos"
            defaultChecked={avisosCorreo}
            className="mt-0.5 size-4 accent-principal"
          />
          <span>Recibir también por correo los avisos de la app</span>
        </label>
      </div>

      {estado.error && <p className="mt-3 aviso aviso-error">{estado.error}</p>}
      {estado.ok && <p className="mt-3 aviso aviso-exito">Datos guardados.</p>}

      <button type="submit" disabled={pendiente} className="boton boton-borde mt-4 w-full">
        {pendiente && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Guardar datos de contacto
      </button>
    </form>
  );
}
