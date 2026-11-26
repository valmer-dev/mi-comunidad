"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { registrarActaPdf } from "@/app/acciones/juntas";
import { TAMANO_MAXIMO_DOCUMENTO } from "@/lib/documentos";
import { crearClienteNavegador } from "@/lib/supabase/navegador";

const LIMITE_MB = TAMANO_MAXIMO_DOCUMENTO / 1024 / 1024;

/**
 * Sube el PDF del acta directamente a Supabase Storage (sin pasar por el
 * límite de las funciones de Vercel) y después lo registra en el servidor.
 */
export function SubirActa({
  juntaId,
  comunidadId,
  reemplazar,
}: {
  juntaId: string;
  comunidadId: string;
  reemplazar: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pendiente, setPendiente] = useState(false);

  async function manejarEnvio(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const archivo = new FormData(formulario).get("acta");

    if (!(archivo instanceof File) || archivo.size === 0) {
      setError("Elige el PDF del acta.");
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_DOCUMENTO) {
      setError(`El PDF no puede superar los ${LIMITE_MB} MB.`);
      return;
    }
    if ((await archivo.slice(0, 5).text()) !== "%PDF-") {
      setError("El archivo no es un PDF válido.");
      return;
    }
    if (reemplazar && !window.confirm("¿Sustituir el acta actual por este PDF?")) return;

    setPendiente(true);
    setError(undefined);
    try {
      const ruta = `${comunidadId}/actas/${crypto.randomUUID()}.pdf`;
      const { error: errorSubida } = await crearClienteNavegador()
        .storage.from("documentos")
        .upload(ruta, archivo, { contentType: "application/pdf", upsert: false });

      if (errorSubida) {
        setError("No se pudo subir el PDF. Inténtalo de nuevo.");
        return;
      }

      const resultado = await registrarActaPdf({ juntaId, ruta });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      formulario.reset();
      router.refresh();
    } catch {
      setError("No se pudo subir el PDF. Inténtalo de nuevo.");
    } finally {
      setPendiente(false);
    }
  }

  return (
    <form onSubmit={manejarEnvio} className="grid gap-2">
      <label htmlFor="acta" className="etiqueta">
        {reemplazar ? "Sustituir el PDF del acta" : "PDF del acta firmada"}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="acta"
          name="acta"
          type="file"
          required
          accept="application/pdf,.pdf"
          className="campo min-w-0 flex-1 file:mr-3 file:rounded-lg file:border-0 file:bg-principal/10 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-principal"
        />
        <button type="submit" disabled={pendiente} className="boton boton-principal">
          {pendiente ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <FileUp className="size-4" aria-hidden />
          )}
          {pendiente ? "Subiendo…" : "Subir acta"}
        </button>
      </div>
      <p className="text-xs text-suave">
        Solo PDF, hasta {LIMITE_MB} MB. También aparecerá en Documentos › Actas.
      </p>
      {error && <p className="aviso aviso-error">{error}</p>}
    </form>
  );
}
