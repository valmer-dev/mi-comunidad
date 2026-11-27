"use client";

import { useActionState, useState } from "react";
import { Camera, Loader2, Plus, Wrench, X } from "lucide-react";
import {
  crearIncidencia,
  registrarFotosIncidencia,
  type EstadoIncidencia,
} from "@/app/acciones/incidencias";
import { MAX_FOTOS_INCIDENCIA, subirFotosIncidencia } from "@/lib/fotos";

const ESTADO_INICIAL: EstadoIncidencia = {};

const TIPOS = [
  { valor: "fontaneria", texto: "Fontanería" },
  { valor: "electricidad", texto: "Electricidad" },
  { valor: "ascensor", texto: "Ascensor" },
  { valor: "limpieza", texto: "Limpieza" },
  { valor: "obra", texto: "Obra" },
  { valor: "ruido", texto: "Ruido" },
  { valor: "zonas_comunes", texto: "Zonas comunes" },
  { valor: "otro", texto: "Otro" },
];

export function NuevaIncidencia({ comunidadId }: { comunidadId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [elegidas, setElegidas] = useState(0);
  const [estado, accion, pendiente] = useActionState(
    async (anterior: EstadoIncidencia, datos: FormData) => {
      // Las fotos van directas al almacenamiento, no a la accion del servidor.
      const fotos = datos
        .getAll("fotos")
        .filter((f): f is File => f instanceof File && f.size > 0)
        .slice(0, MAX_FOTOS_INCIDENCIA);
      datos.delete("fotos");
      const resultado = await crearIncidencia(anterior, datos);
      if (!resultado.ok || !resultado.id) return resultado;

      if (fotos.length) {
        const { rutas, fallidas } = await subirFotosIncidencia(comunidadId, resultado.id, fotos);
        const registro = rutas.length ? await registrarFotosIncidencia(resultado.id, rutas) : { ok: true };
        if (fallidas || registro.error) {
          setElegidas(0);
          return {
            error: "La incidencia se ha registrado, pero alguna foto no se ha podido subir. Puedes añadirlas desde la incidencia.",
          };
        }
      }
      setElegidas(0);
      setAbierto(false);
      return ESTADO_INICIAL;
    },
    ESTADO_INICIAL,
  );

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="boton boton-principal">
        <Plus className="size-4" aria-hidden />
        Nueva incidencia
      </button>
    );
  }

  return (
    <div className="tarjeta w-full">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Wrench className="size-4.5 text-principal" aria-hidden />
          Nueva incidencia
        </h2>
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
        <div className="sm:col-span-2">
          <label htmlFor="titulo" className="etiqueta">
            ¿Qué ocurre?
          </label>
          <input
            id="titulo"
            name="titulo"
            required
            className="campo"
            placeholder="Fuga de agua en el garaje"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="descripcion" className="etiqueta">
            Descripción
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            required
            rows={4}
            className="campo resize-y"
            placeholder="Cuenta dónde está y desde cuándo ocurre…"
          />
        </div>

        <div>
          <label htmlFor="tipo" className="etiqueta">
            Tipo
          </label>
          <select id="tipo" name="tipo" className="campo" defaultValue="otro">
            {TIPOS.map((tipo) => (
              <option key={tipo.valor} value={tipo.valor}>
                {tipo.texto}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="prioridad" className="etiqueta">
            Prioridad
          </label>
          <select id="prioridad" name="prioridad" className="campo" defaultValue="media">
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="ubicacion" className="etiqueta">
            Ubicación (opcional)
          </label>
          <input
            id="ubicacion"
            name="ubicacion"
            className="campo"
            placeholder="Garaje, planta 2, portal…"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="fotos" className="etiqueta">
            Fotos (opcional)
          </label>
          <label htmlFor="fotos" className="boton boton-borde cursor-pointer">
            <Camera className="size-4" aria-hidden />
            {elegidas ? `${elegidas} ${elegidas === 1 ? "foto elegida" : "fotos elegidas"}` : "Hacer o elegir fotos"}
          </label>
          <input
            id="fotos"
            name="fotos"
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => setElegidas(Math.min(e.target.files?.length ?? 0, MAX_FOTOS_INCIDENCIA))}
          />
          <p className="mt-1 text-xs text-suave">Hasta {MAX_FOTOS_INCIDENCIA} fotos. Ayudan a la junta y al seguro.</p>
        </div>

        {estado.error && (
          <p className="aviso aviso-error sm:col-span-2">
            {estado.error}
          </p>
        )}

        <div className="sm:col-span-2">
          <button type="submit" disabled={pendiente} className="boton boton-principal">
            {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Wrench className="size-4" aria-hidden />}
            {pendiente ? "Enviando…" : "Registrar incidencia"}
          </button>
        </div>
      </form>
    </div>
  );
}
