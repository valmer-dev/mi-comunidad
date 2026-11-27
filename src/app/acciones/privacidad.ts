"use server";

import { revalidatePath } from "next/cache";
import { requerirContexto } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/** Anota que la persona ha visto la información de privacidad. */
export async function marcarPrivacidadVista() {
  const { usuario } = await requerirContexto();
  const supabase = await crearClienteServidor();
  await supabase
    .from("perfiles")
    .update({ privacidad_vista_en: new Date().toISOString() })
    .eq("id", usuario.id)
    .is("privacidad_vista_en", null);
  revalidatePath("/", "layout");
}
