"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import {
  Check,
  Copy,
  Loader2,
  Pencil,
  Save,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  actualizarVecino,
  eliminarVecino,
  type EstadoVecinoPlataforma,
} from "@/app/acciones/plataforma";
import {
  ETIQUETAS_ROL,
  etiquetaRol,
  opcionesDeRol,
  type RolAsignable,
  type RolMiembro,
  type RolSistema,
} from "@/lib/permisos";
import { esCorreoInterno, formatearTelefono } from "@/lib/telefono";
import { iniciales } from "@/lib/utilidades";
import { EtiquetaEstado } from "@/components/ui/EtiquetaEstado";
import { NuevoVecino } from "../vecinos/NuevoVecino";

export type CotitularPlataforma = {
  titularId: string;
  usuarioId: string | null;
  nombre: string;
  telefono: string | null;
  correo: string | null;
};

export type VecinoPlataforma = {
  miembroId: string;
  usuarioId: string;
  nombre: string;
  apellidos: string | null;
  correo: string | null;
  telefono: string | null;
  rol: string;
  estado: string;
  fincaId: string | null;
  fincaCodigo: string | null;
  esAdminPlataforma: boolean;
  cotitular: CotitularPlataforma | null;
};

type Finca = { id: string; codigo: string; tipo: string };

type Props = {
  vecinos: VecinoPlataforma[];
  fincas: Finca[];
  roles: RolSistema[];
  nombreComunidad: string;
  urlApp: string;
};

const ESTADO_INICIAL: EstadoVecinoPlataforma = {};

function opcionesConRolActual(rol: string, roles: RolSistema[]) {
  const opciones = opcionesDeRol(roles);

  if (
    rol !== "administrador_plataforma" &&
    !opciones.some((opcion) => opcion.valor === rol)
  ) {
    opciones.splice(opciones.length - 1, 0, {
      valor: rol as RolAsignable,
      etiqueta:
        ETIQUETAS_ROL[rol as RolMiembro] ?? rol.charAt(0).toUpperCase() + rol.slice(1),
      ayuda: "Rol anterior de la comunidad.",
    });
  }

  return opciones;
}

function FormularioVecino({
  vecino,
  fincas,
  roles,
  alCerrar,
}: {
  vecino: VecinoPlataforma;
  fincas: Finca[];
  roles: RolSistema[];
  alCerrar: () => void;
}) {
  const [estado, accion, pendiente] = useActionState(
    actualizarVecino,
    ESTADO_INICIAL,
  );
  const opciones = opcionesConRolActual(vecino.rol, roles);
  const rolInicial = vecino.esAdminPlataforma
    ? "administrador_plataforma"
    : vecino.rol;
  const [rol, setRol] = useState(rolInicial);
  const [fincaId, setFincaId] = useState(vecino.fincaId ?? "");
  const [cotitularTitularId, setCotitularTitularId] = useState(
    vecino.cotitular?.titularId ?? "",
  );
  const [cotitularNombre, setCotitularNombre] = useState(
    vecino.cotitular?.nombre ?? "",
  );
  const [cotitularTelefono, setCotitularTelefono] = useState(
    vecino.cotitular?.telefono ?? "",
  );
  const [cotitularCorreo, setCotitularCorreo] = useState(
    vecino.cotitular?.correo ?? "",
  );
  const [copiado, setCopiado] = useState(false);
  const ayudaRol = opciones.find((opcion) => opcion.valor === rol)?.ayuda;
  // Los correos internos (telefono@telefono.micomunidad.local) no se muestran
  // ni se reenvian: si se enviaran, la validacion los rechazaria.
  const correoVisible =
    vecino.correo && !esCorreoInterno(vecino.correo) ? vecino.correo : "";

  useEffect(() => {
    if (
      "ok" in estado &&
      estado.ok &&
      (!estado.cuentas || estado.cuentas.length === 0)
    ) {
      alCerrar();
    }
  }, [estado, alCerrar]);

  function cambiarFinca(valor: string) {
    setFincaId(valor);
    if (valor !== vecino.fincaId) {
      setCotitularTitularId("");
      setCotitularNombre("");
      setCotitularTelefono("");
      setCotitularCorreo("");
    }
  }

  function copiarCredenciales() {
    if (!("ok" in estado) || !estado.ok || !estado.cuentas?.length) return;
    const texto = estado.cuentas
      .map(
        (cuenta) =>
          `${cuenta.nombre}\nTeléfono: ${cuenta.telefono ?? "-"}\nContraseña: ${cuenta.contrasena}`,
      )
      .join("\n\n");
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <form action={accion} className="rounded-xl border border-borde bg-fondo/60 p-4">
      <input type="hidden" name="miembroId" value={vecino.miembroId} />
      <input type="hidden" name="cotitularTitularId" value={cotitularTitularId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`nombre-${vecino.miembroId}`} className="etiqueta">
            Nombre
          </label>
          <input
            id={`nombre-${vecino.miembroId}`}
            name="nombre"
            required
            defaultValue={vecino.nombre}
            className="campo"
          />
        </div>
        <div>
          <label htmlFor={`apellidos-${vecino.miembroId}`} className="etiqueta">
            Apellidos
          </label>
          <input
            id={`apellidos-${vecino.miembroId}`}
            name="apellidos"
            defaultValue={vecino.apellidos ?? ""}
            className="campo"
          />
        </div>
        <div>
          <label htmlFor={`telefono-${vecino.miembroId}`} className="etiqueta">
            Teléfono
          </label>
          <input
            id={`telefono-${vecino.miembroId}`}
            name="telefono"
            type="tel"
            inputMode="tel"
            defaultValue={vecino.telefono ?? ""}
            className="campo"
            placeholder="600 000 000"
          />
        </div>
        <div>
          <label htmlFor={`correo-${vecino.miembroId}`} className="etiqueta">
            Correo
          </label>
          <input
            id={`correo-${vecino.miembroId}`}
            name="correo"
            type="email"
            defaultValue={correoVisible}
            className="campo"
            placeholder="ana@correo.com"
          />
        </div>
        <div>
          <label htmlFor={`rol-${vecino.miembroId}`} className="etiqueta">
            Rol
          </label>
          <select
            id={`rol-${vecino.miembroId}`}
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
        <div>
          <label htmlFor={`finca-${vecino.miembroId}`} className="etiqueta">
            Vivienda
          </label>
          <select
            id={`finca-${vecino.miembroId}`}
            name="fincaId"
            className="campo"
            value={fincaId}
            onChange={(evento) => cambiarFinca(evento.target.value)}
          >
            <option value="">Sin asignar</option>
            {fincas.map((finca) => (
              <option key={finca.id} value={finca.id}>
                {finca.codigo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {fincaId && (
        <fieldset className="mt-4 rounded-xl border border-borde p-3">
          <legend className="px-1 text-sm font-semibold">
            Segundo titular (opcional)
          </legend>
          <p className="text-xs text-suave">
            Si la vivienda tiene dos titulares, añade al segundo con su propio
            teléfono. Los dos podrán entrar por separado.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor={`cotitular-nombre-${vecino.miembroId}`}
                className="etiqueta"
              >
                Nombre
              </label>
              <input
                id={`cotitular-nombre-${vecino.miembroId}`}
                name="cotitularNombre"
                className="campo"
                value={cotitularNombre}
                onChange={(evento) => setCotitularNombre(evento.target.value)}
                placeholder="Luis García"
              />
            </div>
            <div>
              <label
                htmlFor={`cotitular-telefono-${vecino.miembroId}`}
                className="etiqueta"
              >
                Teléfono
              </label>
              <input
                id={`cotitular-telefono-${vecino.miembroId}`}
                name="cotitularTelefono"
                type="tel"
                inputMode="tel"
                className="campo"
                value={cotitularTelefono}
                onChange={(evento) => setCotitularTelefono(evento.target.value)}
                placeholder="600 000 000"
              />
            </div>
            <div>
              <label
                htmlFor={`cotitular-correo-${vecino.miembroId}`}
                className="etiqueta"
              >
                Correo
              </label>
              <input
                id={`cotitular-correo-${vecino.miembroId}`}
                name="cotitularCorreo"
                type="email"
                className="campo"
                value={cotitularCorreo}
                onChange={(evento) => setCotitularCorreo(evento.target.value)}
                placeholder="luis@correo.com"
              />
            </div>
          </div>
          {vecino.cotitular?.usuarioId && (
            <p className="mt-2 text-xs font-medium text-emerald-700">
              Este titular ya tiene cuenta de acceso.
            </p>
          )}
        </fieldset>
      )}

      {"error" in estado && estado.error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
          {estado.error}
        </p>
      )}

      {"ok" in estado && estado.ok && Boolean(estado.cuentas?.length) && (
        <div className="mt-3 rounded-xl bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">
            Cuenta creada para el segundo titular
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            Entrega estas credenciales. No se volverán a mostrar.
          </p>
          <div className="mt-2 space-y-2">
            {estado.cuentas?.map((cuenta) => (
              <div
                key={cuenta.telefono ?? cuenta.correo ?? cuenta.nombre}
                className="rounded-lg bg-white p-3 font-mono text-sm"
              >
                <p className="font-sans font-semibold">{cuenta.nombre}</p>
                {cuenta.telefono && (
                  <p>Teléfono: {formatearTelefono(cuenta.telefono)}</p>
                )}
                {cuenta.correo && <p>Correo: {cuenta.correo}</p>}
                <p>Contraseña: {cuenta.contrasena}</p>
              </div>
            ))}
          </div>
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
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={pendiente} className="boton boton-principal">
          {pendiente ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {pendiente ? "Guardando…" : "Guardar cambios"}
        </button>
        <button type="button" onClick={alCerrar} className="boton boton-borde">
          <X className="size-4" aria-hidden />
          Cancelar
        </button>
      </div>
    </form>
  );
}

function BotonEliminar({
  miembroId,
  nombre,
}: {
  miembroId: string;
  nombre: string;
}) {
  const [estado, accion, pendiente] = useActionState(
    eliminarVecino,
    ESTADO_INICIAL,
  );

  return (
    <form
      action={accion}
      onSubmit={(evento) => {
        if (
          !window.confirm(
            `¿Eliminar a ${nombre} de la comunidad? Se borrarán también sus datos de vivienda.`,
          )
        ) {
          evento.preventDefault();
        }
      }}
    >
      <input type="hidden" name="miembroId" value={miembroId} />
      <button
        type="submit"
        disabled={pendiente}
        className="boton px-3 py-1.5 text-red-700 hover:bg-red-50"
        title="Eliminar vecino"
      >
        {pendiente ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Trash2 className="size-3.5" aria-hidden />
        )}
        Eliminar
      </button>
      {"error" in estado && estado.error && (
        <p className="mt-1 max-w-[180px] text-xs text-red-700">{estado.error}</p>
      )}
    </form>
  );
}

function FilaVecino({
  vecino,
  fincas,
  roles,
}: {
  vecino: VecinoPlataforma;
  fincas: Finca[];
  roles: RolSistema[];
}) {
  const [editando, setEditando] = useState(false);
  const correoVisible =
    vecino.correo && !esCorreoInterno(vecino.correo) ? vecino.correo : null;

  return (
    <>
      <tr className="align-top">
        <td className="px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-principal-claro text-xs font-bold text-principal-oscuro">
              {iniciales(vecino.nombre, vecino.apellidos)}
            </span>
            <div className="min-w-0">
              <p className="font-semibold leading-tight">
                {vecino.nombre} {vecino.apellidos ?? ""}
              </p>
              <p className="mt-0.5 text-xs text-suave">
                {correoVisible ?? "Sin correo"}
                {vecino.telefono ? ` · ${formatearTelefono(vecino.telefono)}` : ""}
              </p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="font-medium">
            {vecino.esAdminPlataforma
              ? "Administrador Plataforma"
              : etiquetaRol(vecino.rol as RolMiembro, roles)}
          </span>
        </td>
        <td className="px-4 py-3 text-suave">{vecino.fincaCodigo ?? "Sin asignar"}</td>
        <td className="px-4 py-3">
          <EtiquetaEstado estado={vecino.estado} />
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-start justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditando((valor) => !valor)}
              className="boton boton-borde px-3 py-1.5"
            >
              {editando ? (
                <X className="size-3.5" aria-hidden />
              ) : (
                <Pencil className="size-3.5" aria-hidden />
              )}
              {editando ? "Cerrar" : "Editar"}
            </button>
            <BotonEliminar
              miembroId={vecino.miembroId}
              nombre={`${vecino.nombre} ${vecino.apellidos ?? ""}`.trim()}
            />
          </div>
        </td>
      </tr>
      {editando && (
        <tr>
          <td colSpan={5} className="px-4 py-3">
            <FormularioVecino
              vecino={vecino}
              fincas={fincas}
              roles={roles}
              alCerrar={() => setEditando(false)}
            />
          </td>
        </tr>
      )}
    </>
  );
}

export function TablaVecinos({
  vecinos,
  fincas,
  roles,
  nombreComunidad,
  urlApp,
}: Props) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <UserRound className="size-4.5 text-principal" aria-hidden />
          Vecinos de {nombreComunidad} ({vecinos.length})
        </h2>
        <NuevoVecino
          fincas={fincas}
          roles={roles}
          nombreComunidad={nombreComunidad}
          urlApp={urlApp}
        />
      </div>

      {vecinos.length === 0 ? (
        <p className="rounded-2xl border border-borde bg-superficie px-4 py-8 text-center text-sm text-suave">
          Todavía no hay vecinos en esta comunidad. Usa «Añadir vecino» para dar
          de alta al primero.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-borde bg-superficie">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-fondo text-left text-xs uppercase tracking-wide text-suave">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Persona</th>
                <th className="px-4 py-2.5 font-semibold">Rol</th>
                <th className="px-4 py-2.5 font-semibold">Vivienda</th>
                <th className="px-4 py-2.5 font-semibold">Estado</th>
                <th className="px-4 py-2.5 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {vecinos.map((vecino) => (
                <FilaVecino
                  key={vecino.miembroId}
                  vecino={vecino}
                  fincas={fincas}
                  roles={roles}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
