import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/tipos-bd";

/**
 * Cliente con permisos de administrador (service_role).
 * Solo se puede usar en el servidor. Nunca importar desde un componente cliente.
 */
export function crearClienteAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
