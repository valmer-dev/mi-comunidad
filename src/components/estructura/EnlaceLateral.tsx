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
        "relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
        activo
          ? "bg-principal/10 font-semibold text-principal-oscuro before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-principal"
          : "text-suave hover:bg-hundido hover:text-tinta",
      )}
      aria-current={activo ? "page" : undefined}
    >
      <Icono className="size-[18px] shrink-0" aria-hidden />
      {etiqueta}
    </Link>
  );
}
