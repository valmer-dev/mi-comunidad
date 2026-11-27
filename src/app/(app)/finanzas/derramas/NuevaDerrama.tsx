"use client";

import { useActionState, useState } from "react";
import { Hammer, Loader2, Plus, X } from "lucide-react";
import { crearDerrama, type EstadoDerrama } from "@/app/acciones/derramas";

const ESTADO_INICIAL: EstadoDerrama = {};

type Acuerdo = { id: string; titulo: string; junta: string; fecha: string };

const FECHA = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Madrid" });

export function NuevaDerrama({ acuerdos, hoy }: { acuerdos: Acuerdo[]; hoy: string }) {
  const [abierto, setAbierto] = useState(false);
  const [plazos, setPlazos] = useState(1);
  const [estado, accion, pendiente] = useActionState(crearDerrama, ESTADO_INICIAL);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="boton boton-principal">
        <Plus className="size-4" aria-hidden />
        Nueva derrama
      </button>
    );
  }

  return (
    <div className="tarjeta w-full">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Hammer className="size-4.5 text-principal" aria-hidden />
          Nueva derrama
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
      <p className="mt-2 text-[15px] leading-relaxed text-suave">
        Escribe el importe total aprobado. La app lo divide entre los plazos y reparte cada plazo
        entre las viviendas según su coeficiente.
      </p>

      <form action={accion} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="titulo" className="etiqueta">
            Título
          </label>
          <input id="titulo" name="titulo" required maxLength={80} placeholder="Rehabilitación de la fachada" className="campo" />
        </div>

        <div>
          <label htmlFor="importeTotal" className="etiqueta">
            Importe total (€)
          </label>
          <input id="importeTotal" name="importeTotal" inputMode="decimal" required placeholder="24000,00" className="campo" />
        </div>

        <div>
          <label htmlFor="plazos" className="etiqueta">
            Plazos
          </label>
          <input
            id="plazos"
            name="plazos"
            type="number"
            min={1}
            max={60}
            required
            value={plazos}
            onChange={(e) => setPlazos(Number(e.target.value) || 1)}
            className="campo"
          />
        </div>

        <div>
          <label htmlFor="primerVencimiento" className="etiqueta">
            {plazos > 1 ? "Vence el primer plazo" : "Vence el"}
          </label>
          <input id="primerVencimiento" name="primerVencimiento" type="date" required defaultValue={hoy} className="campo" />
        </div>

        {plazos > 1 && (
          <div>
            <label htmlFor="mesesEntrePlazos" className="etiqueta">
              Un plazo cada
            </label>
            <select id="mesesEntrePlazos" name="mesesEntrePlazos" defaultValue="1" className="campo">
              <option value="1">mes</option>
              <option value="2">2 meses</option>
              <option value="3">3 meses (trimestral)</option>
              <option value="6">6 meses (semestral)</option>
              <option value="12">año</option>
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <label htmlFor="puntoId" className="etiqueta">
            Acuerdo de junta que la aprueba
          </label>
          <select id="puntoId" name="puntoId" defaultValue="" className="campo">
            <option value="">Sin enlazar</option>
            {acuerdos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.junta} ({FECHA.format(new Date(a.fecha))}): {a.titulo}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-suave">
            Las derramas se aprueban en junta (art. 17 LPH). Enlazarla deja constancia del acuerdo.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="descripcion" className="etiqueta">
            Descripción (opcional)
          </label>
          <textarea id="descripcion" name="descripcion" rows={2} maxLength={1000} className="campo" />
        </div>

        {estado.error && <p className="aviso aviso-error sm:col-span-2">{estado.error}</p>}
        {estado.ok && estado.mensaje && <p className="aviso aviso-exito sm:col-span-2">{estado.mensaje}</p>}

        <button type="submit" disabled={pendiente} className="boton boton-principal sm:col-span-2">
          {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Hammer className="size-4" aria-hidden />}
          {pendiente ? "Creando…" : "Crear derrama y sus recibos"}
        </button>
      </form>
    </div>
  );
}
