"use client";

import { Printer } from "lucide-react";

/** Abre el dialogo de impresion del navegador, desde el que se guarda en PDF. */
export function BotonImprimir({ etiqueta = "Imprimir o guardar en PDF" }: { etiqueta?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-imprimir boton boton-borde px-3 py-1.5 text-sm"
    >
      <Printer className="size-4" aria-hidden />
      {etiqueta}
    </button>
  );
}
