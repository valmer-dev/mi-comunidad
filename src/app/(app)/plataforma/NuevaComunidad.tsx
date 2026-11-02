"use client";

import { useActionState, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { crearComunidad, type EstadoPlataforma } from "@/app/acciones/plataforma";

const ESTADO_INICIAL: EstadoPlataforma = {};

export function NuevaComunidad() {
  const [estado, accion, pendiente] = useActionState(crearComunidad, ESTADO_INICIAL);
  const [casas, setCasas] = useState(0);
  const [pisos, setPisos] = useState(0);

  const total = casas + pisos;

  return (
    <form action={accion} className="tarjeta grid gap-3">
      <div>
        <label htmlFor="nombre" className="etiqueta">
          Nombre de la comunidad
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          className="campo"
          placeholder="Residencial Los Olivos"
        />
      </div>

      <div>
        <label htmlFor="direccion" className="etiqueta">
          Dirección
        </label>
        <input id="direccion" name="direccion" className="campo" placeholder="Calle Mayor, 1" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="codigoPostal" className="etiqueta">
            Código postal
          </label>
          <input id="codigoPostal" name="codigoPostal" className="campo" placeholder="28001" />
        </div>
        <div>
          <label htmlFor="ciudad" className="etiqueta">
            Ciudad
          </label>
          <input id="ciudad" name="ciudad" className="campo" placeholder="Madrid" />
        </div>
      </div>

      <div>
        <label htmlFor="provincia" className="etiqueta">
          Provincia
        </label>
        <input id="provincia" name="provincia" className="campo" placeholder="Madrid" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="numeroCasas" className="etiqueta">
            Número de casas
          </label>
          <input
            id="numeroCasas"
            name="numeroCasas"
            type="number"
            inputMode="numeric"
            min={0}
            max={500}
            required
            value={casas}
            onChange={(evento) => setCasas(Number(evento.target.value) || 0)}
            className="campo"
          />
        </div>
        <div>
          <label htmlFor="numeroPisos" className="etiqueta">
            Número de pisos
          </label>
          <input
            id="numeroPisos"
            name="numeroPisos"
            type="number"
            inputMode="numeric"
            min={0}
            max={500}
            required
            value={pisos}
            onChange={(evento) => setPisos(Number(evento.target.value) || 0)}
            className="campo"
          />
        </div>
      </div>

      <p className="rounded-xl bg-fondo px-3.5 py-2.5 text-xs leading-relaxed text-suave">
        {total > 0
          ? `Se crearán ${total} fincas (${casas} casas y ${pisos} pisos).`
          : "Indica cuántas casas y pisos tiene la comunidad para generarlas automáticamente."}
      </p>

      {estado.error && (
        <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
          {estado.error}
        </p>
      )}

      <button type="submit" disabled={pendiente} className="boton boton-principal">
        {pendiente ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Building2 className="size-4" aria-hidden />
        )}
        {pendiente ? "Creando…" : "Crear comunidad"}
      </button>

      <p className="text-xs leading-relaxed text-suave">
        Quedarás como presidente de la comunidad. Podrás añadir vecinos y cambiar los
        datos desde Ajustes.
      </p>
    </form>
  );
}
