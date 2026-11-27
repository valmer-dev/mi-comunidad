"use client";

import { useActionState } from "react";
import { Loader2, Mail, Megaphone, Printer } from "lucide-react";
import { registrarEnvioConvocatoria, type EstadoConvocatoria } from "@/app/acciones/convocatoria";
import type { MedioConvocatoria } from "@/lib/convocatoria";

const ESTADO_INICIAL: EstadoConvocatoria = {};

/**
 * Botones para enviar la convocatoria. El correo se abre en el programa de
 * correo de quien convoca, con los vecinos en copia oculta; la app solo
 * anota que se ha enviado.
 */
export function EnviarConvocatoria({
  juntaId,
  medios,
  correos,
  asunto,
  cuerpo,
}: {
  juntaId: string;
  medios: string[];
  correos: string[];
  asunto: string;
  cuerpo: string;
}) {
  const [estado, accion, pendiente] = useActionState(registrarEnvioConvocatoria, ESTADO_INICIAL);

  const mailto =
    `mailto:?bcc=${encodeURIComponent(correos.join(","))}` +
    `&subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;

  return (
    <form action={accion} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="junta_id" value={juntaId} />
      <Boton medio="tablon" icono={Megaphone} texto="Publicar en el tablón" medios={medios} pendiente={pendiente} />
      <Boton
        medio="correo"
        icono={Mail}
        texto={`Enviar por correo (${correos.length})`}
        medios={medios}
        pendiente={pendiente}
        desactivado={correos.length === 0}
        onClick={() => {
          // Un enlace mailto abre el programa de correo sin salir de la pagina,
          // asi el formulario sigue enviandose y queda anotado.
          const enlace = document.createElement("a");
          enlace.href = mailto;
          enlace.click();
        }}
      />
      <Boton medio="papel" icono={Printer} texto="Entregada en papel" medios={medios} pendiente={pendiente} />
      {correos.length === 0 && (
        <p className="w-full text-xs text-suave">
          Ningún vecino tiene un correo real guardado: añádelo en Vecinos para poder enviarla por correo.
        </p>
      )}
      {estado.error && <p className="w-full text-xs text-peligro">{estado.error}</p>}
      {estado.ok && estado.mensaje && <p className="w-full text-xs text-exito">{estado.mensaje}</p>}
    </form>
  );
}

function Boton({
  medio,
  icono: Icono,
  texto,
  medios,
  pendiente,
  desactivado = false,
  onClick,
}: {
  medio: MedioConvocatoria;
  icono: typeof Mail;
  texto: string;
  medios: string[];
  pendiente: boolean;
  desactivado?: boolean;
  onClick?: () => void;
}) {
  const hecho = medios.includes(medio);
  return (
    <button
      type="submit"
      name="medio"
      value={medio}
      disabled={pendiente || desactivado}
      onClick={onClick}
      className={hecho ? "boton boton-borde px-3 py-1.5 text-sm" : "boton boton-principal px-3 py-1.5 text-sm"}
    >
      {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icono className="size-4" aria-hidden />}
      {texto}
      {hecho && " ✓"}
    </button>
  );
}
