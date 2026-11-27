"use client";

import { useActionState, useState } from "react";
import { Ban, Loader2 } from "lucide-react";
import { anularDerrama, type EstadoDerrama } from "@/app/acciones/derramas";

const ESTADO_INICIAL: EstadoDerrama = {};

/** Anular en dos pasos, sin dialogos del navegador. */
export function AnularDerrama({ derramaId }: { derramaId: string }) {
  const [confirmar, setConfirmar] = useState(false);
  const [estado, accion, pendiente] = useActionState(anularDerrama, ESTADO_INICIAL);

  if (!confirmar) {
    return (
      <button type="button" onClick={() => setConfirmar(true)} className="boton boton-borde text-sm">
        <Ban className="size-4" aria-hidden />
        Anular
      </button>
    );
  }

  return (
    <form action={accion} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="derramaId" value={derramaId} />
      <p className="text-xs text-suave">Se anulan los recibos sin cobros.</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setConfirmar(false)} className="boton boton-borde text-sm">
          Cancelar
        </button>
        <button type="submit" disabled={pendiente} className="boton boton-peligro text-sm">
          {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Ban className="size-4" aria-hidden />}
          Sí, anular
        </button>
      </div>
      {estado.error && <p className="aviso aviso-error">{estado.error}</p>}
    </form>
  );
}
