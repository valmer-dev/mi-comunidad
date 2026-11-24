"use client";

import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent } from "react";
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  RemoveFormatting,
  Underline,
} from "lucide-react";

type Props = {
  name: string;
  id?: string;
  valorInicial?: string;
  placeholder?: string;
};

const BOTONES = [
  { comando: "bold", etiqueta: "Negrita", Icono: Bold },
  { comando: "italic", etiqueta: "Cursiva", Icono: Italic },
  { comando: "underline", etiqueta: "Subrayado", Icono: Underline },
  { comando: "insertUnorderedList", etiqueta: "Lista con viñetas", Icono: List },
  { comando: "insertOrderedList", etiqueta: "Lista numerada", Icono: ListOrdered },
] as const;

function leerEstados() {
  const estados: Record<string, boolean> = {};
  for (const boton of BOTONES) {
    try {
      estados[boton.comando] = document.queryCommandState(boton.comando);
    } catch {
      estados[boton.comando] = false;
    }
  }
  return estados;
}

/**
 * Editor sencillo para los anuncios: negrita, cursiva, subrayado, listas,
 * enlaces y quitar formato. Guarda el HTML en un campo oculto; el servidor lo
 * limpia antes de guardarlo y de pintarlo.
 */
export function EditorTextoRico({
  name,
  id,
  valorInicial = "",
  placeholder = "Escribe aquí el anuncio para los vecinos…",
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const ocultoRef = useRef<HTMLInputElement>(null);
  const [vacio, setVacio] = useState(valorInicial.trim().length === 0);
  const [activos, setActivos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = valorInicial;
    if (ocultoRef.current) ocultoRef.current.value = valorInicial;
    setVacio(!editor.textContent?.trim());
    setActivos(leerEstados());
    // En Chrome, Enter crea parrafos en lugar de divs.
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      // Navegador sin soporte: se queda con el comportamiento por defecto.
    }
  }, [valorInicial]);

  function sincronizar() {
    const editor = editorRef.current;
    if (!editor) return;
    if (ocultoRef.current) ocultoRef.current.value = editor.innerHTML;
    setVacio(!editor.textContent?.trim());
  }

  function ejecutar(comando: string, valor?: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(comando, false, valor);
    sincronizar();
    setActivos(leerEstados());
  }

  function crearEnlace() {
    const seleccion = window.getSelection();
    if (!seleccion || seleccion.isCollapsed) {
      window.alert("Selecciona el texto que quieres convertir en enlace.");
      return;
    }

    const direccion = window.prompt("Dirección del enlace (https://… o mailto:…)");
    const limpia = direccion?.trim();
    if (!limpia) return;

    if (!/^(https?:\/\/|mailto:)/i.test(limpia)) {
      window.alert("La dirección debe empezar por https:// o mailto:");
      return;
    }

    ejecutar("createLink", limpia);
  }

  function alPegar(evento: ClipboardEvent<HTMLDivElement>) {
    // Se pega solo el texto: evita arrastrar estilos, imagenes o etiquetas
    // externas que luego el servidor tendria que descartar.
    evento.preventDefault();
    const texto = evento.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, texto);
    sincronizar();
  }

  return (
    <div>
      <div
        role="toolbar"
        aria-label="Formato del anuncio"
        className="flex flex-wrap items-center gap-1 rounded-t-xl border border-b-0 border-borde bg-hundido/70 px-2 py-1.5"
      >
        {BOTONES.map(({ comando, etiqueta, Icono }) => (
          <button
            key={comando}
            type="button"
            title={etiqueta}
            aria-label={etiqueta}
            aria-pressed={Boolean(activos[comando])}
            onMouseDown={(evento) => evento.preventDefault()}
            onClick={() => ejecutar(comando)}
            className={`rounded-lg p-2 transition-colors ${
              activos[comando]
                ? "bg-principal-claro text-principal-oscuro"
                : "text-suave hover:bg-superficie hover:text-tinta"
            }`}
          >
            <Icono className="size-4" aria-hidden />
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-borde" aria-hidden />

        <button
          type="button"
          title="Enlace"
          aria-label="Enlace"
          onMouseDown={(evento) => evento.preventDefault()}
          onClick={crearEnlace}
          className="rounded-lg p-2 text-suave transition-colors hover:bg-superficie hover:text-tinta"
        >
          <Link2 className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          title="Quitar formato"
          aria-label="Quitar formato"
          onMouseDown={(evento) => evento.preventDefault()}
          onClick={() => ejecutar("removeFormat")}
          className="rounded-lg p-2 text-suave transition-colors hover:bg-superficie hover:text-tinta"
        >
          <RemoveFormatting className="size-4" aria-hidden />
        </button>
      </div>

      <div
        ref={editorRef}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-label="Contenido del anuncio"
        contentEditable
        suppressContentEditableWarning
        data-vacio={vacio ? "true" : "false"}
        data-placeholder={placeholder}
        className="campo editor-rico min-h-32 rounded-t-none"
        onInput={sincronizar}
        onPaste={alPegar}
        onKeyUp={() => setActivos(leerEstados())}
        onMouseUp={() => setActivos(leerEstados())}
        onBlur={sincronizar}
      />

      <input ref={ocultoRef} type="hidden" name={name} />
    </div>
  );
}
