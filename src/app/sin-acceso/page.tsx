import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { cerrarSesion } from "@/app/acciones/autenticacion";

export default function SinAcceso() {
  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="tarjeta w-full max-w-md text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-acento-claro text-acento">
          <ShieldAlert className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-bold">Tu cuenta aún no está activa</h1>
        <p className="mt-2 text-sm leading-relaxed text-suave">
          Has iniciado sesión, pero todavía no perteneces a ninguna comunidad.
          Pide al presidente o al secretario que active tu cuenta.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <form action={cerrarSesion}>
            <button type="submit" className="boton boton-borde w-full">
              Cerrar sesión
            </button>
          </form>
          <Link href="/entrar" className="text-sm font-medium text-principal hover:underline">
            Volver a entrar
          </Link>
        </div>
      </div>
    </main>
  );
}
