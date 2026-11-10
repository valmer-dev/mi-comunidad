"use client";

import { useActionState, useState } from "react";
import { Loader2, Pencil, Save, X } from "lucide-react";
import { actualizarComunidad, type EstadoComunidad } from "@/app/acciones/comunidad";

type Datos = {
  nombre: string;
  direccion: string | null;
  codigo_postal: string | null;
  ciudad: string | null;
  provincia: string | null;
  cif: string | null;
  iban: string | null;
  administrador_nombre: string | null;
  administrador_telefono: string | null;
  administrador_correo: string | null;
};

const ESTADO_INICIAL: EstadoComunidad = {};

export function EditarComunidad({ datos }: { datos: Datos }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(
    async (anterior: EstadoComunidad, datos: FormData) => {
      const resultado = await actualizarComunidad(anterior, datos);
      if (resultado.ok) setAbierto(false);
      return resultado.ok ? ESTADO_INICIAL : resultado;
    },
    ESTADO_INICIAL,
  );

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="boton boton-borde mt-4 w-full"
      >
        <Pencil className="size-4" aria-hidden />
        Editar datos de la comunidad
      </button>
    );
  }

  return (
    <form action={accion} className="mt-4 border-t border-borde pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Editar datos</h3>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-lg p-1 text-suave hover:bg-fondo"
          aria-label="Cerrar"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="nombre" className="etiqueta">
            Nombre de la comunidad
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            defaultValue={datos.nombre}
            className="campo"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="direccion" className="etiqueta">
            Dirección
          </label>
          <input
            id="direccion"
            name="direccion"
            defaultValue={datos.direccion ?? ""}
            className="campo"
          />
        </div>

        <div>
          <label htmlFor="codigoPostal" className="etiqueta">
            Código postal
          </label>
          <input
            id="codigoPostal"
            name="codigoPostal"
            defaultValue={datos.codigo_postal ?? ""}
            className="campo"
          />
        </div>

        <div>
          <label htmlFor="ciudad" className="etiqueta">
            Ciudad
          </label>
          <input
            id="ciudad"
            name="ciudad"
            defaultValue={datos.ciudad ?? ""}
            className="campo"
          />
        </div>

        <div>
          <label htmlFor="provincia" className="etiqueta">
            Provincia
          </label>
          <input
            id="provincia"
            name="provincia"
            defaultValue={datos.provincia ?? ""}
            className="campo"
          />
        </div>

        <div>
          <label htmlFor="cif" className="etiqueta">
            CIF
          </label>
          <input id="cif" name="cif" defaultValue={datos.cif ?? ""} className="campo" />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="iban" className="etiqueta">
            IBAN
          </label>
          <input id="iban" name="iban" defaultValue={datos.iban ?? ""} className="campo" />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="administradorNombre" className="etiqueta">
            Administrador de fincas
          </label>
          <input
            id="administradorNombre"
            name="administradorNombre"
            defaultValue={datos.administrador_nombre ?? ""}
            className="campo"
          />
        </div>

        <div>
          <label htmlFor="administradorTelefono" className="etiqueta">
            Teléfono del administrador
          </label>
          <input
            id="administradorTelefono"
            name="administradorTelefono"
            defaultValue={datos.administrador_telefono ?? ""}
            className="campo"
          />
        </div>

        <div>
          <label htmlFor="administradorCorreo" className="etiqueta">
            Correo del administrador
          </label>
          <input
            id="administradorCorreo"
            name="administradorCorreo"
            type="email"
            defaultValue={datos.administrador_correo ?? ""}
            className="campo"
          />
        </div>
      </div>

      {estado.error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
          {estado.error}
        </p>
      )}

      <button type="submit" disabled={pendiente} className="boton boton-principal mt-3">
        {pendiente ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Save className="size-4" aria-hidden />
        )}
        {pendiente ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
