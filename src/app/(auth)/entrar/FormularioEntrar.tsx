"use client";

import { useActionState } from "react";
import { Building2, Loader2, LogIn } from "lucide-react";
import { entrar, type EstadoEntrar } from "@/app/acciones/autenticacion";

const ESTADO_INICIAL: EstadoEntrar = {};

export function FormularioEntrar() {
  const [estado, accion, pendiente] = useActionState(entrar, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label htmlFor="identificador" className="etiqueta">
          Teléfono o correo
        </label>
        <input
          id="identificador"
          name="identificador"
          type="text"
          autoComplete="username"
          required
          placeholder="600 000 000"
          className="campo"
        />
      </div>

      <div>
        <label htmlFor="contrasena" className="etiqueta">
          Contraseña
        </label>
        <input
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="campo"
        />
      </div>

      {estado.error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700"
        >
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="boton boton-principal w-full py-3 text-base"
      >
        {pendiente ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <LogIn className="size-5" aria-hidden />
        )}
        {pendiente ? "Entrando…" : "Entrar"}
      </button>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-suave">
        <Building2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        El acceso es solo por invitación. Si no tienes cuenta, pídesela al
        presidente o al secretario de la comunidad.
      </p>
    </form>
  );
}
