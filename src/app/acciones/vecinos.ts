"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador } from "@/lib/permisos";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { generarContrasenaTemporal } from "@/lib/utilidades";

const esquema = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre."),
  correo: z.string().trim().email("El correo no es válido."),
  telefono: z.string().trim().optional(),
  rol: z.enum([
    "presidente",
    "vicepresidente",
    "secretario",
    "vocal",
    "propietario",
    "inquilino",
    "administrador_fincas",
  ]),
  fincaId: z.string().uuid().optional().or(z.literal("")),
});

export type EstadoVecino =
  | { error?: string }
  | { ok: true; correo: string; contrasena: string; nombre: string };

export async function crearVecino(
  _estado: EstadoVecino,
  datos: FormData,
): Promise<EstadoVecino> {
  const { miembro, comunidad } = await requerirContexto();
  if (!esAdministrador(miembro.rol)) {
    return { error: "No tienes permiso para añadir vecinos." };
  }

  const resultado = esquema.safeParse({
    nombre: datos.get("nombre"),
    correo: datos.get("correo"),
    telefono: datos.get("telefono") || undefined,
    rol: datos.get("rol"),
    fincaId: datos.get("fincaId") || "",
  });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const { nombre, correo, telefono, rol, fincaId } = resultado.data;
  const contrasena = generarContrasenaTemporal();
  const admin = crearClienteAdmin();

  const { data: creado, error: errorAuth } = await admin.auth.admin.createUser({
    email: correo.toLowerCase(),
    password: contrasena,
    email_confirm: true,
    user_metadata: { nombre },
  });

  if (errorAuth || !creado.user) {
    if (errorAuth?.message?.toLowerCase().includes("already")) {
      return { error: "Ya existe una cuenta con ese correo." };
    }
    return { error: "No se pudo crear la cuenta. Inténtalo de nuevo." };
  }

  const supabase = await crearClienteServidor();

  const { error: errorMiembro } = await supabase.from("miembros").insert({
    comunidad_id: comunidad.id,
    usuario_id: creado.user.id,
    rol,
    estado: "activo",
    finca_principal_id: fincaId || null,
  });

  if (errorMiembro) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return { error: "No se pudo añadir el vecino a la comunidad." };
  }

  if (telefono) {
    await admin.from("perfiles").update({ telefono }).eq("id", creado.user.id);
  }

  if (fincaId) {
    await supabase.from("titulares").insert({
      finca_id: fincaId,
      usuario_id: creado.user.id,
      tipo: rol === "inquilino" ? "inquilino" : "propietario",
    });
  }

  revalidatePath("/vecinos");
  revalidatePath("/panel");

  return { ok: true, correo, contrasena, nombre };
}
