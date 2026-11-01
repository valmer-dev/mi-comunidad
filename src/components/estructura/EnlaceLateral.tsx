"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utilidades";

type Props = {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
};

export function EnlaceLateral({ href, etiqueta, icono: Icono }: Props) {
  const ruta = usePathname();
  const activo = ruta === href || ruta.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        activo
          ? "bg-principal/10 text-principal-oscuro"
          : "text-suave hover:bg-fondo hover:text-tinta",
      )}
      aria-current={activo ? "page" : undefined}
    >
      <Icono className="size-[18px] shrink-0" aria-hidden />
      {etiqueta}
    </Link>
  );
}
