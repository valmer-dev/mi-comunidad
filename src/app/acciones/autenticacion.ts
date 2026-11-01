"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type EstadoEntrar = { error?: string };

export async function entrar(
  _estado: EstadoEntrar,
  datos: FormData,
): Promise<EstadoEntrar> {
  const correo = String(datos.get("correo") ?? "")
    .trim()
    .toLowerCase();
  const contrasena = String(datos.get("contrasena") ?? "");

  if (!correo || !contrasena) {
    return { error: "Introduce tu correo y tu contraseña." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: contrasena,
  });

  if (error) {
    return { error: "Correo o contraseña incorrectos." };
  }

  revalidatePath("/", "layout");
  redirect("/panel");
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/entrar");
}
