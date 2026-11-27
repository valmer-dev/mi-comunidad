"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { marcarPrivacidadVista } from "@/app/acciones/privacidad";

/**
 * Aviso que se muestra hasta que la persona confirma que ha leído cómo trata
 * la comunidad sus datos (art. 13 RGPD). Es informativo: no pide
 * consentimiento, porque la comunidad trata los datos por la Ley de Propiedad
 * Horizontal.
 */
export function AvisoPrivacidad({ nombreComunidad }: { nombreComunidad: string }) {
  const [pendiente, iniciar] = useTransition();

  return (
    <div className="no-imprimir mb-5 flex flex-wrap items-start gap-3 rounded-2xl border border-principal/30 bg-principal-claro/60 p-4 text-sm">
      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-principal" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Cómo usa la comunidad tus datos</p>
        <p className="mt-0.5 text-suave">
          La Comunidad de Propietarios {nombreComunidad} trata tus datos para gestionar la
          comunidad: cuotas, juntas, avisos e incidencias. Puedes pedir verlos, corregirlos o
          llevártelos.{" "}
          <Link href="/privacidad" className="font-medium text-principal underline">
            Leer la información completa
          </Link>
        </p>
      </div>
      <button
        type="button"
        disabled={pendiente}
        onClick={() => iniciar(() => marcarPrivacidadVista())}
        className="boton boton-principal px-3 py-1.5 text-xs"
      >
        {pendiente && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        Entendido
      </button>
    </div>
  );
}
