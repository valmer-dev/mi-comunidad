"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  correoDesdeTelefono,
  identificadorDesdeEntrada,
  normalizarTelefono,
  telefonoValido,
} from "@/lib/telefono";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type EstadoEntrar = { error?: string };

/**
 * Devuelve el correo de Auth para un telefono. La mayoria de los vecinos se
 * crean con un correo interno, pero si la cuenta se creo con un correo real
 * (y luego se le anadio el telefono) hay que entrar con ese correo.
 */
async function correoDeAuthPorTelefono(identificador: string) {
  if (identificador.includes("@") || !telefonoValido(identificador)) return null;

  const telefono = normalizarTelefono(identificador);
  const admin = crearClienteAdmin();

  const { data: perfil } = await admin
    .from("perfiles")
    .select("id")
    .eq("telefono", telefono)
    .maybeSingle();

  if (!perfil) return null;

  const { data } = await admin.auth.admin.getUserById(perfil.id);
  const correo = data?.user?.email;
  if (!correo) return null;

  // Si ya es el correo interno del telefono, no aporta nada nuevo.
  if (correo.toLowerCase() === correoDesdeTelefono(telefono)) return null;

  return correo;
}

export async function entrar(
  _estado: EstadoEntrar,
  datos: FormData,
): Promise<EstadoEntrar> {
  const identificador = String(datos.get("identificador") ?? "").trim();
  const contrasena = String(datos.get("contrasena") ?? "");

  if (!identificador || !contrasena) {
    return { error: "Introduce tu teléfono o correo y tu contraseña." };
  }

  const supabase = await crearClienteServidor();
  const correo = identificador.includes("@")
    ? identificador.toLowerCase()
    : identificadorDesdeEntrada(identificador);

  let { error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: contrasena,
  });

  if (error && !identificador.includes("@")) {
    const correoReal = await correoDeAuthPorTelefono(identificador);
    if (correoReal) {
      ({ error } = await supabase.auth.signInWithPassword({
        email: correoReal,
        password: contrasena,
      }));
    }
  }

  if (error) {
    return { error: "Teléfono, correo o contraseña incorrectos." };
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
