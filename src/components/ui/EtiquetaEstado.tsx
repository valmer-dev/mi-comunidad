import { cn } from "@/lib/utilidades";

const ATENCION = "bg-atencion-claro text-atencion";
const INFO = "bg-info-claro text-info";
const EXITO = "bg-exito-claro text-exito";
const PELIGRO = "bg-peligro-claro text-peligro";
const ACENTO = "bg-acento-claro text-acento";
const NEUTRO = "bg-neutro-claro text-neutro";

const COLORES: Record<string, string> = {
  abierta: ATENCION,
  en_curso: INFO,
  resuelta: EXITO,
  cerrada: NEUTRO,
  pendiente: ATENCION,
  pagado: EXITO,
  parcial: INFO,
  devuelto: PELIGRO,
  aplazado: ACENTO,
  anulado: NEUTRO,
  borrador: NEUTRO,
  convocada: INFO,
  celebrada: EXITO,
  aprobada: EXITO,
  aprobado: EXITO,
  rechazada: PELIGRO,
  cancelada: NEUTRO,
  urgente: PELIGRO,
  alta: ACENTO,
  media: ATENCION,
  baja: NEUTRO,
  activo: EXITO,
  inactivo: NEUTRO,
  invitado: INFO,
};

/** Estados que muestran un punto de color para no depender solo del fondo. */
export function EtiquetaEstado({
  estado,
  className,
}: {
  estado: string;
  className?: string;
}) {
  const texto = estado.replaceAll("_", " ");
  return (
    <span className={cn("chip", COLORES[estado] ?? NEUTRO, className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {texto.charAt(0).toUpperCase() + texto.slice(1)}
    </span>
  );
}
