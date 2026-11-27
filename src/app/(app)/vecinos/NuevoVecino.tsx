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
  /** Solo un administrador de plataforma puede dar ese acceso. */
  conPlataforma?: boolean;
  nombreComunidad: string;
  urlApp: string;
};

const ESTADO_INICIAL: EstadoVecino = {};

type ResultadoAlta = Extract<EstadoVecino, { ok: true }>;

function textoCredenciales(resultado: ResultadoAlta) {
  return [
    "Acceso a Mi Comunidad",
    ...resultado.cuentas.map((cuenta) =>
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

function TarjetaResultado({
  resultado,
  nombreComunidad,
  urlApp,
  copiado,
  onCopiar,
  onCerrar,
  onOtro,
}: {
  resultado: ResultadoAlta;
  nombreComunidad: string;
  urlApp: string;
  copiado: boolean;
  onCopiar: () => void;
  onCerrar: () => void;
  onOtro: () => void;
}) {
  return (
    <div className="tarjeta w-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {resultado.cuentas.length === 0
              ? `${resultado.nombre} añadido a la comunidad`
              : resultado.cuentas.length === 1
                ? `Cuenta creada para ${resultado.cuentas[0].nombre}`
                : "Cuentas creadas para los dos titulares"}
          </h2>
          <p className="mt-0.5 text-sm text-suave">
            {resultado.cuentas.length > 0
              ? "Envía la invitación por WhatsApp o copia las credenciales. No se volverán a mostrar."
              : "No hace falta contraseña nueva."}
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="grid size-11 place-items-center rounded-full text-suave hover:bg-hundido hover:text-tinta"
          aria-label="Cerrar"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {resultado.cuentas.map((cuenta) => {
          const mensaje = mensajeWhatsApp(cuenta, {
            nombreComunidad,
            urlApp,
            fincaCodigo: resultado.fincaCodigo,
          });
          const enlace = enlaceWhatsApp(cuenta, mensaje);
          return (
            <div key={cuenta.nombre + (cuenta.telefono ?? cuenta.correo)} className="rounded-lg bg-superficie p-3">
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

      {resultado.aviso && (
        <p className="mt-2 text-sm text-exito">{resultado.aviso}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {resultado.cuentas.length > 0 && (
          <button type="button" onClick={onCopiar} className="boton boton-borde">
            {copiado ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {copiado ? "Copiado" : "Copiar credenciales"}
          </button>
        )}
        <button type="button" onClick={onOtro} className="boton boton-borde">
          <UserPlus className="size-4" aria-hidden />
          Añadir otro vecino
        </button>
      </div>
    </div>
  );
}

export function NuevoVecino({ fincas, roles, conPlataforma = false, nombreComunidad, urlApp }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [rol, setRol] = useState("vecino");
  const [resultado, setResultado] = useState<ResultadoAlta | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [estado, accion, pendiente] = useActionState(
    async (anterior: EstadoVecino, datos: FormData) => {
      const creado = await crearVecino(anterior, datos);
      if ("ok" in creado && creado.ok) {
        setResultado(creado);
        setAbierto(false);
        return ESTADO_INICIAL;
      }
      return creado;
    },
    ESTADO_INICIAL,
  );

  const opciones = opcionesDeRol(roles, { conPlataforma });
  const ayudaRol = opciones.find((opcion) => opcion.valor === rol)?.ayuda;
  const casas = fincas.filter((finca) => finca.tipo === "casa");
  const pisos = fincas.filter((finca) => finca.tipo === "piso");
  const otras = fincas.filter(
    (finca) => finca.tipo !== "casa" && finca.tipo !== "piso",
  );

  function abrirFormulario() {
    setResultado(null);
    setAbierto(true);
  }

  function copiarCredenciales() {
    if (!resultado) return;
    navigator.clipboard.writeText(textoCredenciales(resultado));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (!abierto) {
    if (resultado) {
      return (
        <TarjetaResultado
          resultado={resultado}
          nombreComunidad={nombreComunidad}
          urlApp={urlApp}
          copiado={copiado}
          onCopiar={copiarCredenciales}
          onCerrar={() => setResultado(null)}
          onOtro={abrirFormulario}
        />
      );
    }

    return (
      <button type="button" onClick={abrirFormulario} className="boton boton-principal">
        <UserPlus className="size-4" aria-hidden />
        Añadir vecino
      </button>
    );
  }

  return (
    <div className="tarjeta w-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Nuevo vecino</h2>
          <p className="mt-0.5 text-sm text-suave">
            Se crea la cuenta con el teléfono y se genera la invitación para WhatsApp.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="grid size-11 place-items-center rounded-full text-suave hover:bg-hundido hover:text-tinta"
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
          <p className="aviso aviso-error sm:col-span-2">
            {estado.error}
          </p>
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
