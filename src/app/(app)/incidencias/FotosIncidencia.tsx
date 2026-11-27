"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import {
  eliminarFotoIncidencia,
  registrarFotosIncidencia,
  type EstadoIncidencia,
} from "@/app/acciones/incidencias";
import { MAX_FOTOS_INCIDENCIA, subirFotosIncidencia } from "@/lib/fotos";

export type Foto = { id: string; url: string; puedeBorrar: boolean };

const ESTADO_INICIAL: EstadoIncidencia = {};

function BotonBorrarFoto({ id }: { id: string }) {
  const [, accion, pendiente] = useActionState(eliminarFotoIncidencia, ESTADO_INICIAL);
  return (
    <form action={accion} className="absolute right-1 top-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pendiente}
        className="grid size-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
        aria-label="Eliminar foto"
      >
        {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
      </button>
    </form>
  );
}

export function FotosIncidencia({
  comunidadId,
  incidenciaId,
  fotos,
  puedeAnadir,
}: {
  comunidadId: string;
  incidenciaId: string;
  fotos: Foto[];
  puedeAnadir: boolean;
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string>();
  const quedan = MAX_FOTOS_INCIDENCIA - fotos.length;

  async function alElegir(lista: FileList | null) {
    const archivos = Array.from(lista ?? []).slice(0, quedan);
    if (archivos.length === 0) return;
    setError(undefined);
    setSubiendo(true);
    try {
      const { rutas, fallidas } = await subirFotosIncidencia(comunidadId, incidenciaId, archivos);
      if (rutas.length) {
        const resultado = await registrarFotosIncidencia(incidenciaId, rutas);
        if (resultado.error) setError(resultado.error);
      }
      if (fallidas) setError(`${fallidas === 1 ? "Una foto no se ha" : `${fallidas} fotos no se han`} podido subir (JPEG, PNG o WebP de hasta 10 MB).`);
      router.refresh();
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  if (fotos.length === 0 && !puedeAnadir) return null;

  return (
    <div className="mt-3">
      {fotos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {fotos.map((foto) => (
            <li key={foto.id} className="relative aspect-square overflow-hidden rounded-xl bg-hundido">
              <a href={foto.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal */}
                <img src={foto.url} alt="Foto de la incidencia" loading="lazy" className="size-full object-cover" />
              </a>
              {foto.puedeBorrar && <BotonBorrarFoto id={foto.id} />}
            </li>
          ))}
        </ul>
      )}
      {puedeAnadir && quedan > 0 && (
        <>
          <input
            ref={entrada}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            id={`fotos-${incidenciaId}`}
            onChange={(e) => alElegir(e.target.files)}
          />
          <label
            htmlFor={`fotos-${incidenciaId}`}
            className="boton boton-borde mt-2 cursor-pointer px-3 py-1.5 text-xs"
            aria-disabled={subiendo}
          >
            {subiendo ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Camera className="size-3.5" aria-hidden />}
            {subiendo ? "Subiendo…" : fotos.length ? "Añadir más fotos" : "Añadir fotos"}
          </label>
        </>
      )}
      {error && <p className="aviso aviso-error mt-2">{error}</p>}
    </div>
  );
}
