import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2, Users, Wallet, Wrench } from "lucide-react";
import { obtenerUsuarioActual } from "@/lib/auth";
import { destinoSeguro } from "@/lib/utilidades";
import { FormularioEntrar } from "./FormularioEntrar";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string | string[] }>;
}) {
  const usuario = await obtenerUsuarioActual();
  if (usuario) redirect("/panel");

  const { destino } = await searchParams;
  const destinoFinal = destinoSeguro(
    typeof destino === "string" ? destino : undefined,
  );

  return (
    <main className="flex min-h-dvh flex-col lg:flex-row">
      {/* Presentacion */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-principal px-6 py-10 text-white lg:w-1/2 lg:px-16 lg:py-16">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-black/10"
          aria-hidden
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-white/15">
              <Building2 className="size-6" aria-hidden />
            </span>
            <span className="text-lg font-semibold tracking-tight">Mi Comunidad</span>
          </div>

          <h1 className="mt-10 max-w-md text-3xl font-bold leading-tight tracking-tight lg:mt-16 lg:text-5xl">
            Todo lo de tu comunidad, en un solo sitio.
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/80 lg:text-lg">
            Cuotas, juntas, actas, incidencias y documentos. Sin grupos de
            mensajes interminables y sin papeles perdidos.
          </p>
        </div>

        <ul className="relative mt-10 grid gap-3 text-sm text-white/90 sm:grid-cols-2 lg:mt-16">
          {[
            { icono: Users, texto: "Vecinos y fincas" },
            { icono: Wallet, texto: "Cuotas y gastos" },
            { icono: Wrench, texto: "Incidencias" },
            { icono: Building2, texto: "Juntas y acuerdos" },
          ].map(({ icono: Icono, texto }) => (
            <li key={texto} className="flex items-center gap-2.5">
              <Icono className="size-4 shrink-0" aria-hidden />
              {texto}
            </li>
          ))}
        </ul>
      </section>

      {/* Formulario */}
      <section className="flex flex-1 items-center justify-center px-5 py-10 lg:px-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold tracking-tight">Accede a tu cuenta</h2>
          <p className="mt-1.5 text-sm text-suave">
            Usa tu teléfono o tu correo y la contraseña que te dio la comunidad.
          </p>
          <div className="mt-7">
            <FormularioEntrar destino={destinoFinal} />
          </div>
          <p className="mt-8 text-center text-xs text-suave">
            Mi Comunidad · Gestión vecinal
          </p>
        </div>
      </section>
    </main>
  );
}
