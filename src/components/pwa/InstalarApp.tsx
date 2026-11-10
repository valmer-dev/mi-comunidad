"use client";

import { useState, useSyncExternalStore } from "react";
import { CheckCircle2, Download, Smartphone } from "lucide-react";
import {
  obtenerEventoInstalacion,
  olvidarEventoInstalacion,
  suscribirInstalacion,
} from "@/lib/instalacion";

function suscribirModoApp(avisar: () => void) {
  const consulta = window.matchMedia("(display-mode: standalone)");
  consulta.addEventListener("change", avisar);
  window.addEventListener("appinstalled", avisar);

  return () => {
    consulta.removeEventListener("change", avisar);
    window.removeEventListener("appinstalled", avisar);
  };
}

function enModoApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

export function InstalarApp() {
  const evento = useSyncExternalStore(
    suscribirInstalacion,
    obtenerEventoInstalacion,
    () => null,
  );
  const enApp = useSyncExternalStore(suscribirModoApp, enModoApp, () => false);
  const [instaladaAhora, setInstaladaAhora] = useState(false);

  const instalada = enApp || instaladaAhora;

  async function instalar() {
    if (!evento) return;

    try {
      await evento.prompt();
      const eleccion = await evento.userChoice;

      if (eleccion.outcome === "accepted") setInstaladaAhora(true);
    } finally {
      // El evento solo sirve para un intento: si se cancela, mostramos los pasos.
      olvidarEventoInstalacion();
    }
  }

  if (instalada) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
        Ya está instalada en este dispositivo.
      </p>
    );
  }

  if (evento) {
    return (
      <div className="space-y-2">
        <button type="button" onClick={instalar} className="boton boton-principal">
          <Download className="size-4" aria-hidden />
          Instalar app
        </button>
        <p className="text-xs text-suave">
          Se añadirá un icono a tu pantalla de inicio y se abrirá a pantalla
          completa.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-fondo px-3.5 py-3 text-sm leading-relaxed text-suave">
      <Smartphone className="mt-0.5 size-4 shrink-0 text-principal" aria-hidden />
      <div>
        <p>
          En Android: abre esta página en Chrome, toca el menú ⋮ y elige
          «Instalar app» o «Añadir a pantalla de inicio».
        </p>
        <p className="mt-1.5">
          En iPhone o iPad: ábrela en Safari, toca Compartir y elige «Añadir a
          pantalla de inicio».
        </p>
        <p className="mt-1.5 text-xs">
          Si has llegado desde WhatsApp, ábrela antes en Chrome o Safari.
        </p>
      </div>
    </div>
  );
}
