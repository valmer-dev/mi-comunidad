"use client";

import { useActionState, useRef, useState } from "react";
import { CalendarPlus, Loader2, Plus, X } from "lucide-react";
import { crearObligacion, type EstadoObligacion } from "@/app/acciones/obligaciones";
import { CATEGORIAS_OBLIGACION, PLANTILLAS_OBLIGACION } from "@/lib/obligaciones";

const ESTADO_INICIAL: EstadoObligacion = {};

const PERIODOS = [
  { valor: "", texto: "No se repite" },
  { valor: "1", texto: "Cada mes" },
  { valor: "3", texto: "Cada 3 meses" },
  { valor: "6", texto: "Cada 6 meses" },
  { valor: "12", texto: "Cada año" },
  { valor: "24", texto: "Cada 2 años" },
  { valor: "48", texto: "Cada 4 años" },
  { valor: "60", texto: "Cada 5 años" },
  { valor: "72", texto: "Cada 6 años" },
  { valor: "120", texto: "Cada 10 años" },
];

export function NuevaObligacion({ proveedores, hoy }: { proveedores: { id: string; nombre: string }[]; hoy: string }) {
  const [abierto, setAbierto] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  const [estado, accion, pendiente] = useActionState(async (anterior: EstadoObligacion, datos: FormData) => {
    const resultado = await crearObligacion(anterior, datos);
    if (resultado.ok) formulario.current?.reset();
    return resultado;
  }, ESTADO_INICIAL);

  function usarPlantilla(indice: string) {
    const plantilla = PLANTILLAS_OBLIGACION[Number(indice)];
    const f = formulario.current;
    if (!plantilla || !f) return;
    (f.elements.namedItem("titulo") as HTMLInputElement).value = plantilla.titulo;
    (f.elements.namedItem("descripcion") as HTMLTextAreaElement).value = plantilla.descripcion;
    (f.elements.namedItem("categoria") as HTMLSelectElement).value = plantilla.categoria;
    (f.elements.namedItem("cadaMeses") as HTMLSelectElement).value = plantilla.cadaMeses ? String(plantilla.cadaMeses) : "";
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="boton boton-principal">
        <Plus className="size-4" aria-hidden />
        Añadir obligación
      </button>
    );
  }

  return (
    <div className="tarjeta w-full">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarPlus className="size-4.5 text-principal" aria-hidden />
          Nueva obligación
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

      <form ref={formulario} action={accion} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="plantilla" className="etiqueta">
            Empezar desde una habitual (opcional)
          </label>
          <select id="plantilla" defaultValue="" onChange={(e) => usarPlantilla(e.target.value)} className="campo">
            <option value="">Elige una…</option>
            {PLANTILLAS_OBLIGACION.map((p, i) => (
              <option key={p.titulo} value={i}>
                {p.titulo}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="titulo" className="etiqueta">
            Qué hay que hacer
          </label>
          <input id="titulo" name="titulo" required maxLength={120} className="campo" />
        </div>

        <div>
          <label htmlFor="fecha" className="etiqueta">
            Fecha
          </label>
          <input id="fecha" name="fecha" type="date" required defaultValue={hoy} className="campo" />
        </div>

        <div>
          <label htmlFor="cadaMeses" className="etiqueta">
            Se repite
          </label>
          <select id="cadaMeses" name="cadaMeses" defaultValue="" className="campo">
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.texto}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="categoria" className="etiqueta">
            Tipo
          </label>
          <select id="categoria" name="categoria" defaultValue="otra" className="campo">
            {Object.entries(CATEGORIAS_OBLIGACION).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="avisoDias" className="etiqueta">
            Avisar con antelación
          </label>
          <select id="avisoDias" name="avisoDias" defaultValue="30" className="campo">
            <option value="7">Una semana antes</option>
            <option value="15">15 días antes</option>
            <option value="30">Un mes antes</option>
            <option value="60">Dos meses antes</option>
            <option value="90">Tres meses antes</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="proveedorId" className="etiqueta">
            Proveedor (opcional)
          </label>
          <select id="proveedorId" name="proveedorId" defaultValue="" className="campo">
            <option value="">Ninguno</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="descripcion" className="etiqueta">
            Notas (opcional)
          </label>
          <textarea id="descripcion" name="descripcion" rows={2} maxLength={1000} className="campo" />
        </div>

        {estado.error && <p className="aviso aviso-error sm:col-span-2">{estado.error}</p>}
        {estado.ok && estado.mensaje && <p className="aviso aviso-exito sm:col-span-2">{estado.mensaje}</p>}

        <button type="submit" disabled={pendiente} className="boton boton-principal sm:col-span-2">
          {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CalendarPlus className="size-4" aria-hidden />}
          {pendiente ? "Guardando…" : "Añadir al calendario"}
        </button>
      </form>
    </div>
  );
}
