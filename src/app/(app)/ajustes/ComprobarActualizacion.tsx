"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";

type Estado = "inicial" | "comprobando" | "al-dia" | "disponible" | "error";

/** Version incrustada en este build (ver `env` en next.config.ts). */
const VERSION_ACTUAL = process.env.NEXT_PUBLIC_VERSION ?? "local";

function corta(version: string) {
  return version.length > 12 ? version.slice(0, 7) : version;
}

export function ComprobarActualizacion() {
  const [estado, setEstado] = useState<Estado>("inicial");
  const [versionServidor, setVersionServidor] = useState<string | null>(null);

  async function comprobar() {
    setEstado("comprobando");

    try {
      // Pide al navegador que busque un service worker nuevo. El HTML de las
      // navegaciones ya va a red, asi que la recarga trae el build nuevo.
      if ("serviceWorker" in navigator) {
        const registro = await navigator.serviceWorker.getRegistration();
        await registro?.update().catch(() => undefined);
      }

      const respuesta = await fetch("/api/version", { cache: "no-store" });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

      const datos = (await respuesta.json()) as { version?: string };
      const version = datos.version ?? "local";

      setVersionServidor(version);
      setEstado(version === VERSION_ACTUAL ? "al-dia" : "disponible");
    } catch {
      setEstado("error");
    }
  }

  if (estado === "disponible") {
    return (
      <div className="space-y-2">
        <p className="aviso aviso-atencion">
          Hay una versión nueva ({corta(VERSION_ACTUAL)} →{" "}
          {corta(versionServidor ?? "")}).
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="boton boton-principal"
        >
          <RefreshCw className="size-4" aria-hidden />
          Actualizar ahora
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={comprobar}
        disabled={estado === "comprobando"}
        className="boton boton-borde"
      >
        {estado === "comprobando" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <RefreshCw className="size-4" aria-hidden />
        )}
        {estado === "comprobando"
          ? "Comprobando…"
          : "Comprobar actualizaciones"}
      </button>

      {estado === "al-dia" && (
        <p className="flex items-center gap-2 text-xs font-medium text-exito">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
          Estás al día (versión {corta(VERSION_ACTUAL)}).
        </p>
      )}

      {estado === "error" && (
        <p className="text-xs font-medium text-peligro">
          No se pudo comprobar. Revisa tu conexión e inténtalo de nuevo.
        </p>
      )}
    </div>
  );
}
