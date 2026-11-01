"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Loader2, UserPlus, X } from "lucide-react";
import { crearVecino, type EstadoVecino } from "@/app/acciones/vecinos";

type Finca = { id: string; codigo: string; tipo: string };

const ESTADO_INICIAL: EstadoVecino = {};

export function NuevoVecino({ fincas }: { fincas: Finca[] }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(crearVecino, ESTADO_INICIAL);
  const [copiado, setCopiado] = useState(false);

  function copiarCredenciales() {
    if (!("ok" in estado) || !estado.ok) return;
    navigator.clipboard.writeText(
      `Acceso a Mi Comunidad\nCorreo: ${estado.correo}\nContraseña: ${estado.contrasena}`,
    );
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="boton boton-principal">
        <UserPlus className="size-4" aria-hidden />
        Añadir vecino
      </button>
    );
  }

  return (
    <div className="tarjeta w-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Nuevo vecino</h2>
          <p className="mt-0.5 text-sm text-suave">
            Se crea la cuenta y se le entrega la contraseña temporal.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-lg p-1.5 text-suave hover:bg-fondo"
          aria-label="Cerrar"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <form action={accion} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nombre" className="etiqueta">
            Nombre y apellidos
          </label>
          <input id="nombre" name="nombre" required className="campo" placeholder="Ana García" />
        </div>

        <div>
          <label htmlFor="correo" className="etiqueta">
            Correo electrónico
          </label>
          <input
            id="correo"
            name="correo"
            type="email"
            required
            className="campo"
            placeholder="ana@correo.com"
          />
        </div>

        <div>
          <label htmlFor="telefono" className="etiqueta">
            Teléfono (opcional)
          </label>
          <input id="telefono" name="telefono" type="tel" className="campo" placeholder="600 000 000" />
        </div>

        <div>
          <label htmlFor="rol" className="etiqueta">
            Rol
          </label>
          <select id="rol" name="rol" className="campo" defaultValue="propietario">
            <option value="propietario">Propietario</option>
            <option value="inquilino">Inquilino</option>
            <option value="vocal">Vocal</option>
            <option value="secretario">Secretario</option>
            <option value="vicepresidente">Vicepresidente</option>
            <option value="presidente">Presidente</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="fincaId" className="etiqueta">
            Finca (opcional)
          </label>
          <select id="fincaId" name="fincaId" className="campo" defaultValue="">
            <option value="">Sin asignar todavía</option>
            {fincas.map((finca) => (
              <option key={finca.id} value={finca.id}>
                {finca.codigo} · {finca.tipo}
              </option>
            ))}
          </select>
        </div>

        {"error" in estado && estado.error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700 sm:col-span-2">
            {estado.error}
          </p>
        )}

        {"ok" in estado && estado.ok && (
          <div className="rounded-xl bg-emerald-50 p-4 sm:col-span-2">
            <p className="text-sm font-semibold text-emerald-900">
              Cuenta creada para {estado.nombre}
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              Entrega estas credenciales al vecino. No se volverán a mostrar.
            </p>
            <div className="mt-3 rounded-lg bg-white p-3 font-mono text-sm text-tinta">
              <p>Correo: {estado.correo}</p>
              <p>Contraseña: {estado.contrasena}</p>
            </div>
            <button
              type="button"
              onClick={copiarCredenciales}
              className="boton boton-borde mt-3"
            >
              {copiado ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copiado ? "Copiado" : "Copiar credenciales"}
            </button>
          </div>
        )}

        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" disabled={pendiente} className="boton boton-principal">
            {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
            {pendiente ? "Creando…" : "Crear cuenta"}
          </button>
        </div>
      </form>
    </div>
  );
}
