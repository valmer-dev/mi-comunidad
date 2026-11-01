"use client";

import { useActionState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { cambiarContrasena, type EstadoContrasena } from "@/app/acciones/cuenta";

const ESTADO_INICIAL: EstadoContrasena = {};

export function CambiarContrasena() {
  const [estado, accion, pendiente] = useActionState(cambiarContrasena, ESTADO_INICIAL);

  return (
    <form action={accion} className="mt-5 border-t border-borde pt-5">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <KeyRound className="size-4 text-principal" aria-hidden />
        Cambiar contraseña
      </h3>
      <p className="mt-1 text-xs text-suave">
        Usa al menos 8 caracteres. Si has entrado con la contraseña temporal,
        cámbiala ahora.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="contrasena" className="etiqueta">
            Nueva contraseña
          </label>
          <input
            id="contrasena"
            name="contrasena"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="campo"
          />
        </div>
        <div>
          <label htmlFor="repetir" className="etiqueta">
            Repítela
          </label>
          <input
            id="repetir"
            name="repetir"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="campo"
          />
        </div>
      </div>

      {estado.error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800">
          Contraseña actualizada.
        </p>
      )}

      <button type="submit" disabled={pendiente} className="boton boton-borde mt-3">
        {pendiente ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <KeyRound className="size-4" aria-hidden />
        )}
        {pendiente ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
