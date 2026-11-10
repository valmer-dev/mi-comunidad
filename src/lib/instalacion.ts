"use client";

/**
 * Pequeño almacen para no perder el evento `beforeinstallprompt`.
 * Chrome lo dispara una sola vez, normalmente antes de que el usuario
 * llegue a Ajustes; lo capturamos en el layout raiz y lo guardamos aqui.
 */

export type EventoInstalacion = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let evento: EventoInstalacion | null = null;
const oyentes = new Set<() => void>();

function avisar() {
  oyentes.forEach((oyente) => oyente());
}

export function capturarInstalacion() {
  if (typeof window === "undefined") return () => {};

  const alPoderInstalar = (eventoNativo: Event) => {
    eventoNativo.preventDefault();
    evento = eventoNativo as EventoInstalacion;
    avisar();
  };

  const alInstalar = () => {
    evento = null;
    avisar();
  };

  window.addEventListener("beforeinstallprompt", alPoderInstalar);
  window.addEventListener("appinstalled", alInstalar);

  return () => {
    window.removeEventListener("beforeinstallprompt", alPoderInstalar);
    window.removeEventListener("appinstalled", alInstalar);
  };
}

export function obtenerEventoInstalacion() {
  return evento;
}

/** El aviso nativo solo se puede usar una vez; tras lanzarlo lo olvidamos. */
export function olvidarEventoInstalacion() {
  evento = null;
  avisar();
}

export function suscribirInstalacion(oyente: () => void) {
  oyentes.add(oyente);

  return () => {
    oyentes.delete(oyente);
  };
}
