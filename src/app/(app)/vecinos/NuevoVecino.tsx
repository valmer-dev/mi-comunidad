"use client";

import { useActionState, useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  MessageCircle,
  UserPlus,
  X,
} from "lucide-react";
import { crearVecino, type CuentaCreada, type EstadoVecino } from "@/app/acciones/vecinos";
import { opcionesDeRol, type RolSistema } from "@/lib/permisos";
import { formatearTelefono } from "@/lib/telefono";

type Finca = { id: string; codigo: string; tipo: string };

type Props = {
  fincas: Finca[];
  roles?: RolSistema[];
  nombreComunidad: string;
  urlApp: string;
};

const ESTADO_INICIAL: EstadoVecino = {};

function textoCredenciales(estado: EstadoVecino) {
  if (!("ok" in estado) || !estado.ok) return "";
  return [
    "Acceso a Mi Comunidad",
    ...estado.cuentas.map((cuenta) =>
      [
        `\n${cuenta.nombre}`,
        cuenta.telefono ? `Teléfono: ${formatearTelefono(cuenta.telefono)}` : "",
        cuenta.correo ? `Correo: ${cuenta.correo}` : "",
        `Contraseña: ${cuenta.contrasena}`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n");
}

function mensajeWhatsApp(
  cuenta: CuentaCreada,
  estado: { nombreComunidad: string; urlApp: string; fincaCodigo: string | null },
) {
  const lineas = [
    `Hola ${cuenta.nombre}, te he dado de alta en Mi Comunidad (${estado.nombreComunidad}).`,
    "",
    `Entra en ${estado.urlApp}/entrar`,
    cuenta.telefono ? `Teléfono: ${formatearTelefono(cuenta.telefono)}` : "",
    cuenta.correo ? `Correo: ${cuenta.correo}` : "",
    `Contraseña temporal: ${cuenta.contrasena}`,
    estado.fincaCodigo ? `Tu vivienda: ${estado.fincaCodigo}` : "",
    "",
    "Cuando entres, puedes cambiar la contraseña en Ajustes.",
  ];
  return lineas.filter((linea) => linea !== "").join("\n");
}

function enlaceWhatsApp(cuenta: CuentaCreada, mensaje: string) {
  if (!cuenta.telefono) return null;
  return `https://wa.me/34${cuenta.telefono}?text=${encodeURIComponent(mensaje)}`;
}

export function NuevoVecino({ fincas, roles, nombreComunidad, urlApp }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [rol, setRol] = useState("vecino");
  const [estado, accion, pendiente] = useActionState(crearVecino, ESTADO_INICIAL);
  const [copiado, setCopiado] = useState(false);

  const opciones = opcionesDeRol(roles);
  const ayudaRol = opciones.find((opcion) => opcion.valor === rol)?.ayuda;
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
            Se crea la cuenta con el teléfono y se genera la invitación para WhatsApp.
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
          <label htmlFor="telefono" className="etiqueta">
            Teléfono (para entrar)
          </label>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            required
            inputMode="tel"
            autoComplete="off"
            className="campo"
            placeholder="600 000 000"
          />
        </div>

        <div>
          <label htmlFor="correo" className="etiqueta">
            Correo electrónico (opcional)
          </label>
          <input
            id="correo"
            name="correo"
            type="email"
            className="campo"
            placeholder="ana@correo.com"
          />
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
            {opciones.map((opcion) => (
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
            Si la casa o el piso tiene dos propietarios, añade al segundo. Con teléfono
            o correo tendrá su propia cuenta; solo con nombre queda registrado sin acceso.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="titular2Nombre" className="etiqueta">
                Nombre
              </label>
              <input
                id="titular2Nombre"
                name="titular2Nombre"
                className="campo"
                placeholder="Luis García"
              />
            </div>
            <div>
              <label htmlFor="titular2Telefono" className="etiqueta">
                Teléfono
              </label>
              <input
                id="titular2Telefono"
                name="titular2Telefono"
                type="tel"
                inputMode="tel"
                className="campo"
                placeholder="600 000 000"
              />
            </div>
            <div>
              <label htmlFor="titular2Correo" className="etiqueta">
                Correo
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
              {estado.cuentas.length === 0
                ? `${estado.nombre} añadido a la comunidad`
                : estado.cuentas.length === 1
                  ? `Cuenta creada para ${estado.cuentas[0].nombre}`
                  : "Cuentas creadas para los dos titulares"}
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              {estado.cuentas.length > 0
                ? "Envía la invitación por WhatsApp o copia las credenciales. No se volverán a mostrar."
                : "No hace falta contraseña nueva."}
            </p>

            <div className="mt-3 space-y-3">
              {estado.cuentas.map((cuenta) => {
                const mensaje = mensajeWhatsApp(cuenta, {
                  nombreComunidad,
                  urlApp,
                  fincaCodigo: estado.fincaCodigo,
                });
                const enlace = enlaceWhatsApp(cuenta, mensaje);
                return (
                  <div key={cuenta.nombre + (cuenta.telefono ?? cuenta.correo)} className="rounded-lg bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-suave">
                      {cuenta.nombre}
                    </p>
                    <div className="mt-1 font-mono text-sm text-tinta">
                      {cuenta.telefono && <p>Teléfono: {formatearTelefono(cuenta.telefono)}</p>}
                      {cuenta.correo && <p>Correo: {cuenta.correo}</p>}
                      <p>Contraseña: {cuenta.contrasena}</p>
                    </div>
                    {enlace && (
                      <a
                        href={enlace}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="boton boton-principal mt-2"
                      >
                        <MessageCircle className="size-4" aria-hidden />
                        Enviar invitación por WhatsApp
                      </a>
                    )}
                  </div>
                );
              })}
            </div>

            {estado.aviso && (
              <p className="mt-2 text-sm text-emerald-800">{estado.aviso}</p>
            )}

            {estado.cuentas.length > 0 && (
              <button
                type="button"
                onClick={copiarCredenciales}
                className="boton boton-borde mt-3"
              >
                {copiado ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <Copy className="size-4" aria-hidden />
                )}
                {copiado ? "Copiado" : "Copiar credenciales"}
              </button>
            )}
          </div>
        )}

        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" disabled={pendiente} className="boton boton-principal">
            {pendiente ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <UserPlus className="size-4" aria-hidden />
            )}
            {pendiente ? "Creando…" : "Crear cuenta"}
          </button>
        </div>
      </form>
    </div>
  );
}
