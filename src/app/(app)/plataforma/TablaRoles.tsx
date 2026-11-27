"use client";

import { Fragment, useEffect, useState } from "react";
import { useActionState } from "react";
import { Loader2, Lock, Pencil, Save, X } from "lucide-react";
import { actualizarRol, type EstadoRol } from "@/app/acciones/plataforma";
import type { RolSistema } from "@/lib/permisos";

const ESTADO_INICIAL: EstadoRol = {};

const PERMISOS = [
  { campo: "administra_comunidad", etiqueta: "Administrar la comunidad" },
  { campo: "gestiona_vecinos", etiqueta: "Gestionar vecinos" },
  { campo: "gestiona_documentos", etiqueta: "Gestionar documentos" },
  { campo: "gestiona_incidencias", etiqueta: "Gestionar incidencias" },
  { campo: "ver_finanzas", etiqueta: "Ver finanzas" },
  { campo: "edita_finanzas", etiqueta: "Editar finanzas (gastos, recibos, presupuestos, derramas)" },
] as const;

const ETIQUETAS_CORTAS: Record<(typeof PERMISOS)[number]["campo"], string> = {
  administra_comunidad: "Comunidad",
  gestiona_vecinos: "Vecinos",
  gestiona_documentos: "Documentos",
  gestiona_incidencias: "Incidencias",
  ver_finanzas: "Finanzas",
  edita_finanzas: "Editar finanzas",
};

function ResumenPermisos({ rol }: { rol: RolSistema }) {
  const activos = PERMISOS.filter((permiso) => rol[permiso.campo]);

  if (activos.length === 0) {
    return <span className="text-xs text-suave">Sin permisos</span>;
  }

  return (
    <span className="flex flex-wrap gap-1.5">
      {activos.map((permiso) => (
        <span
          key={permiso.campo}
          className="chip bg-principal/10 text-principal-oscuro"
        >
          {ETIQUETAS_CORTAS[permiso.campo]}
        </span>
      ))}
    </span>
  );
}

function FormularioRol({
  rol,
  alGuardar,
}: {
  rol: RolSistema;
  alGuardar: () => void;
}) {
  const [estado, accion, pendiente] = useActionState(actualizarRol, ESTADO_INICIAL);

  useEffect(() => {
    if ("ok" in estado && estado.ok) alGuardar();
  }, [estado, alGuardar]);

  return (
    <form action={accion} className="rounded-xl border border-borde bg-hundido/60 p-4">
      <input type="hidden" name="clave" value={rol.clave} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`nombre-${rol.clave}`} className="etiqueta">
            Nombre
          </label>
          <input
            id={`nombre-${rol.clave}`}
            name="nombre"
            required
            defaultValue={rol.nombre}
            className="campo"
          />
        </div>
        <div>
          <label htmlFor={`descripcion-${rol.clave}`} className="etiqueta">
            Descripción
          </label>
          <input
            id={`descripcion-${rol.clave}`}
            name="descripcion"
            defaultValue={rol.descripcion ?? ""}
            className="campo"
            placeholder="Qué puede hacer este rol"
          />
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">Permisos</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {PERMISOS.map((permiso) => (
            <label
              key={permiso.campo}
              className="flex items-center gap-2.5 rounded-lg border border-borde bg-superficie px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name={permiso.campo}
                defaultChecked={rol[permiso.campo]}
                className="size-4 accent-principal"
              />
              {permiso.etiqueta}
            </label>
          ))}
        </div>
      </fieldset>

      {"error" in estado && estado.error && (
        <p className="mt-3 aviso aviso-error">
          {estado.error}
        </p>
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
        <button type="button" onClick={alGuardar} className="boton boton-borde">
          <X className="size-4" aria-hidden />
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function TablaRoles({ roles }: { roles: RolSistema[] }) {
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-2xl border border-borde bg-superficie">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="bg-hundido text-left text-xs uppercase tracking-wider text-suave">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Rol</th>
            <th className="px-4 py-2.5 font-semibold">Descripción</th>
            <th className="px-4 py-2.5 font-semibold">Permisos</th>
            <th className="px-4 py-2.5 text-right font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-borde">
          {roles.map((rol) => (
            <Fragment key={rol.clave}>
              <tr className="align-top">
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{rol.nombre}</span>
                    {rol.es_admin_plataforma && (
                      <span className="chip bg-acento-claro text-acento">
                        <Lock className="size-3" aria-hidden />
                        Protegido
                      </span>
                    )}
                  </div>
                </td>
                <td className="max-w-xs px-4 py-3 text-suave">
                  {rol.descripcion || "Sin descripción"}
                </td>
                <td className="px-4 py-3">
                  <ResumenPermisos rol={rol} />
                </td>
                <td className="px-4 py-3 text-right">
                  {rol.es_admin_plataforma ? (
                    <span className="text-xs text-suave">Siempre todos</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setEditando((actual) => (actual === rol.clave ? null : rol.clave))
                      }
                      className="boton boton-borde px-3 py-1.5"
                    >
                      {editando === rol.clave ? (
                        <X className="size-3.5" aria-hidden />
                      ) : (
                        <Pencil className="size-3.5" aria-hidden />
                      )}
                      {editando === rol.clave ? "Cerrar" : "Editar"}
                    </button>
                  )}
                </td>
              </tr>
              {editando === rol.clave && !rol.es_admin_plataforma && (
                <tr>
                  <td colSpan={4} className="px-4 py-3">
                    <FormularioRol
                      rol={rol}
                      alGuardar={() => setEditando(null)}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
