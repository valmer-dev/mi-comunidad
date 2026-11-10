"use client";

import { useEffect } from "react";

/**
 * Registra el service worker solo en produccion. En `next dev` se evita
 * para no cachear chunks de desarrollo ni mezclar versiones.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const registrar = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // Si falla el registro, la app sigue funcionando como web normal.
        });
    };

    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar, { once: true });
  }, []);

  return null;
}
