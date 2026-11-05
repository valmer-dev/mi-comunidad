import { limpiarContenidoAnuncio } from "@/lib/anuncios";
import { cn } from "@/lib/utilidades";

type Props = {
  contenido: string;
  className?: string;
};

/**
 * Pinta el contenido de un anuncio. El HTML se limpia en el servidor con una
 * lista cerrada de etiquetas; el texto plano antiguo se escapa y conserva sus
 * saltos de linea.
 */
export function ContenidoAnuncio({ contenido, className }: Props) {
  return (
    <div
      className={cn("contenido-rico", className)}
      dangerouslySetInnerHTML={{ __html: limpiarContenidoAnuncio(contenido) }}
    />
  );
}
