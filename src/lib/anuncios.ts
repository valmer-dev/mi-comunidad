import sanitizeHtml from "sanitize-html";

/**
 * Contenido de los anuncios.
 *
 * Los anuncios nuevos se escriben con un editor enriquecido y se guardan como
 * HTML restringido. Los anuncios antiguos son texto plano, asi que al pintarlos
 * se detecta el formato y se escapa el texto cuando hace falta. Todo pasa por
 * `sanitize-html` antes de llegar al navegador: nunca se confia en el HTML que
 * envia el formulario.
 */

const ETIQUETAS = [
  "p",
  "div",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
  "h3",
  "h4",
];

const PATRON_HTML =
  /<\/?(p|div|br|strong|b|em|i|u|ul|ol|li|a|blockquote|h[3-6])\b[^>]*>/i;

const ENTIDADES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function escaparTexto(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function desescaparTexto(texto: string) {
  return texto.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (entidad) => {
    return ENTIDADES[entidad] ?? entidad;
  });
}

/** Indica si el contenido guardado usa el formato del editor. */
export function esContenidoRico(contenido: string) {
  return PATRON_HTML.test(contenido);
}

/**
 * Devuelve HTML seguro para pintar un anuncio. El texto plano antiguo se
 * escapa y conserva sus saltos de linea; el HTML se limpia con una lista
 * cerrada de etiquetas y atributos.
 */
export function limpiarContenidoAnuncio(contenido: string) {
  if (!esContenidoRico(contenido)) {
    return escaparTexto(contenido).replace(/\r?\n/g, "<br>");
  }

  return sanitizeHtml(contenido, {
    allowedTags: ETIQUETAS,
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (etiqueta, atributos) => ({
        tagName: etiqueta,
        attribs: {
          ...atributos,
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        },
      }),
    },
  });
}

/** Texto plano del anuncio: para extractos y para validar que no queda vacio. */
export function textoPlanoAnuncio(contenido: string) {
  const texto = esContenidoRico(contenido)
    ? sanitizeHtml(contenido, { allowedTags: [], allowedAttributes: {} })
    : contenido;

  return desescaparTexto(texto).replace(/\s+/g, " ").trim();
}
