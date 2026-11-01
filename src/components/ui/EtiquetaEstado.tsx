import { cn } from "@/lib/utilidades";

const COLORES: Record<string, string> = {
  abierta: "bg-amber-100 text-amber-800",
  en_curso: "bg-blue-100 text-blue-800",
  resuelta: "bg-emerald-100 text-emerald-800",
  cerrada: "bg-slate-100 text-slate-600",
  pendiente: "bg-amber-100 text-amber-800",
  pagado: "bg-emerald-100 text-emerald-800",
  devuelto: "bg-red-100 text-red-700",
  aplazado: "bg-orange-100 text-orange-800",
  anulado: "bg-slate-100 text-slate-500",
  borrador: "bg-slate-100 text-slate-600",
  convocada: "bg-blue-100 text-blue-800",
  celebrada: "bg-emerald-100 text-emerald-800",
  aprobada: "bg-emerald-100 text-emerald-800",
  rechazada: "bg-red-100 text-red-700",
  cancelada: "bg-slate-100 text-slate-500",
  urgente: "bg-red-100 text-red-700",
  alta: "bg-orange-100 text-orange-800",
  media: "bg-amber-100 text-amber-800",
  baja: "bg-slate-100 text-slate-600",
  activo: "bg-emerald-100 text-emerald-800",
  inactivo: "bg-slate-100 text-slate-600",
  invitado: "bg-blue-100 text-blue-800",
};

export function EtiquetaEstado({
  estado,
  className,
}: {
  estado: string;
  className?: string;
}) {
  const texto = estado.replaceAll("_", " ");
  return (
    <span className={cn("chip", COLORES[estado] ?? "bg-slate-100 text-slate-600", className)}>
      {texto.charAt(0).toUpperCase() + texto.slice(1)}
    </span>
  );
}
