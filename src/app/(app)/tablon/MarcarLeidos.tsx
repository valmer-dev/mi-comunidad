"use client";

import { useEffect } from "react";
import { marcarAnunciosLeidos } from "@/app/acciones/notificaciones";

/** Anota en segundo plano que se han visto los anuncios del tablón. */
export function MarcarLeidos({ ids }: { ids: string[] }) {
  const clave = ids.join(",");
  useEffect(() => {
    if (!clave) return;
    void marcarAnunciosLeidos(clave.split(","));
  }, [clave]);
  return null;
}
