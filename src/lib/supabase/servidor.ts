import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/tipos-bd";

/**
 * Cliente de Supabase para componentes y acciones de servidor.
 * Usa la sesion del usuario (cookies), por lo que RLS se aplica siempre.
 */
export async function crearClienteServidor() {
  const almacen = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return almacen.getAll();
        },
        setAll(lista) {
          try {
            lista.forEach(({ name, value, options }) => {
              almacen.set(name, value, options);
            });
          } catch {
            // En componentes de servidor (no acciones) no se pueden escribir cookies.
            // El proxy se encarga de refrescar la sesion.
          }
        },
      },
    },
  );
}
