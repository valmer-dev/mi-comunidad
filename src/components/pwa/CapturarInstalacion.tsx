"use client";

import { useEffect } from "react";
import { capturarInstalacion } from "@/lib/instalacion";

/** Captura el evento de instalacion de la PWA en cuanto se carga la app. */
export function CapturarInstalacion() {
  useEffect(() => capturarInstalacion(), []);

  return null;
}
