"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Loader2, UserPlus, X } from "lucide-react";
import { crearVecino, type EstadoVecino } from "@/app/acciones/vecinos";
import { ROLES_ASIGNABLES } from "@/lib/permisos";

type Finca = { id: string; codigo: string; tipo: string };

const ESTADO_INICIAL: EstadoVecino = {};

function textoCredenciales(estado: EstadoVecino) {
  if (!("ok" in estado) || !estado.ok) return "";
  return [
    "Acceso a Mi Comunidad",
    ...estado.cuentas.map(
      (cuenta) =>
        `\n${cuenta.nombre}\nCorreo: ${cuenta.correo}\nContraseña: ${cuenta.contrasena}`,
    ),
  ].join("\n");
}

export function NuevoVecino({ fincas }: { fincas: Finca[] }) {
  const [abierto, setAbierto] = useState(false);
  const [rol, setRol] = useState("vecino");
  const [estado, accion, pendiente] = useActionState(crearVecino, ESTADO_INICIAL);
  const [copiado, setCopiado] = useState(false);
  const ayudaRol = ROLES_ASIGNABLES.find((opcion) => opcion.valor === rol)?.ayuda;

  const casas = fincas.filter((finca) => finca.tipo === "casa");
  const pisos = fincas.filter((finca) => finca.tipo === "piso");
  const otras = fincas.filter(
    (finca) => finca.tipo !== "casa" && finca.tipo !== "piso",
  );

  function copiarCredenciales() {
    if (!("ok" in estado) || !estado.ok) return;
    navigator.clipboard.writeText(textoCredenciales(estado));
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
          <select
            id="rol"
            name="rol"
            className="campo"
            value={rol}
            onChange={(evento) => setRol(evento.target.value)}
          >
            {ROLES_ASIGNABLES.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
          {ayudaRol && <p className="mt-1 text-xs text-suave">{ayudaRol}</p>}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="fincaId" className="etiqueta">
            Casa o piso (opcional)
          </label>
          <select id="fincaId" name="fincaId" className="campo" defaultValue="">
            <option value="">Sin asignar todavía</option>
            {casas.length > 0 && (
              <optgroup label="Casas">
                {casas.map((finca) => (
                  <option key={finca.id} value={finca.id}>
                    {finca.codigo}
                  </option>
                ))}
              </optgroup>
            )}
            {pisos.length > 0 && (
              <optgroup label="Pisos">
                {pisos.map((finca) => (
                  <option key={finca.id} value={finca.id}>
                    {finca.codigo}
                  </option>
                ))}
              </optgroup>
            )}
            {otras.length > 0 && (
              <optgroup label="Otras fincas">
                {otras.map((finca) => (
                  <option key={finca.id} value={finca.id}>
                    {finca.codigo}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {fincas.length === 0 && (
            <p className="mt-1 text-xs text-suave">
              Todavía no hay casas ni pisos. Puedes crearlos en Ajustes.
            </p>
          )}
        </div>

        <fieldset className="rounded-xl border border-borde p-3 sm:col-span-2">
          <legend className="px-1 text-sm font-semibold">Segundo titular (opcional)</legend>
          <p className="text-xs text-suave">
            Si la casa o el piso tiene dos propietarios, añade al segundo. Con correo
            tendrá su propia cuenta; solo con nombre queda registrado sin acceso.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="titular2Nombre" className="etiqueta">
                Nombre del segundo titular
              </label>
              <input
                id="titular2Nombre"
                name="titular2Nombre"
                className="campo"
                placeholder="Luis García"
              />
            </div>
            <div>
              <label htmlFor="titular2Correo" className="etiqueta">
                Correo del segundo titular
              </label>
              <input
                id="titular2Correo"
                name="titular2Correo"
                type="email"
                className="campo"
                placeholder="luis@correo.com"
              />
            </div>
          </div>
        </fieldset>

        {"error" in estado && estado.error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700 sm:col-span-2">
            {estado.error}
          </p>
        )}

        {"ok" in estado && estado.ok && (
          <div className="rounded-xl bg-emerald-50 p-4 sm:col-span-2">
            <p className="text-sm font-semibold text-emerald-900">
              {estado.cuentas.length > 1
                ? `Cuentas creadas para ${estado.nombre} y el segundo titular`
                : `Cuenta creada para ${estado.nombre}`}
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              Entrega estas credenciales. No se volverán a mostrar.
            </p>
            <div className="mt-3 space-y-2">
              {estado.cuentas.map((cuenta) => (
                <div
                  key={cuenta.correo}
                  className="rounded-lg bg-white p-3 font-mono text-sm text-tinta"
                >
                  <p className="font-sans text-xs font-semibold uppercase tracking-wide text-suave">
                    {cuenta.nombre}
                  </p>
                  <p>Correo: {cuenta.correo}</p>
                  <p>Contraseña: {cuenta.contrasena}</p>
                </div>
              ))}
            </div>
            {estado.aviso && (
              <p className="mt-2 text-sm text-emerald-800">{estado.aviso}</p>
            )}
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
