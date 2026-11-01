"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import { esAdministrador } from "@/lib/permisos";
import { generarContrasenaTemporal } from "@/lib/contrasenas";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const esquema = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre."),
  correo: z.string().trim().toLowerCase().email("El correo no es válido."),
  telefono: z.string().trim().optional(),
  rol: z.enum(["presidente", "vicepresidente", "vocal", "vecino"]),
  fincaId: z.string().uuid().optional().or(z.literal("")),
  titular2Nombre: z.string().trim().optional(),
  titular2Correo: z
    .union([z.literal(""), z.string().trim().toLowerCase().email("El correo del segundo titular no es válido.")])
    .optional(),
});

export type CuentaCreada = { nombre: string; correo: string; contrasena: string };

export type EstadoVecino =
  | { error?: string }
  | {
      ok: true;
      nombre: string;
      cuentas: CuentaCreada[];
      /** Aviso para titulares que ya tenían cuenta y no necesitan contraseña. */
      aviso?: string;
    };

/**
 * Da de alta a un vecino con su cuenta, su rol y, si se indica, su casa o piso.
 * Permite añadir un segundo titular: con correo se le crea (o reutiliza) la
 * cuenta; solo con nombre queda registrado como titular sin acceso.
 */
export async function crearVecino(
  _estado: EstadoVecino,
  datos: FormData,
): Promise<EstadoVecino> {
  const { miembro, comunidad, esAdminPlataforma } = await requerirContexto();
  if (!esAdminPlataforma && !esAdministrador(miembro.rol)) {
    return { error: "No tienes permiso para añadir vecinos." };
  }

  const resultado = esquema.safeParse({
    nombre: datos.get("nombre"),
    correo: datos.get("correo"),
    telefono: datos.get("telefono") || undefined,
    rol: datos.get("rol"),
    fincaId: datos.get("fincaId") || "",
    titular2Nombre: datos.get("titular2Nombre") || undefined,
    titular2Correo: datos.get("titular2Correo") || "",
  });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const { nombre, correo, telefono, rol, fincaId, titular2Nombre, titular2Correo } =
    resultado.data;

  const haySegundoTitular = Boolean(titular2Nombre || titular2Correo);
  if (haySegundoTitular && !fincaId) {
    return { error: "Elige la casa o el piso para poder añadir titulares." };
  }
  if (titular2Correo && titular2Correo === correo) {
    return { error: "El segundo titular no puede tener el mismo correo que el primero." };
  }
  if (!titular2Nombre && titular2Correo) {
    return { error: "Escribe el nombre del segundo titular." };
  }

  const admin = crearClienteAdmin();
  const contrasena = generarContrasenaTemporal();

  const { data: creado, error: errorAuth } = await admin.auth.admin.createUser({
    email: correo,
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

  const usuarioId = creado.user.id;
  const supabase = await crearClienteServidor();
  const cuentas: CuentaCreada[] = [{ nombre, correo, contrasena }];
  let aviso: string | undefined;
  let segundoId: string | null = null;
  let segundoCreado = false;

  try {
    const { error: errorMiembro } = await supabase.from("miembros").insert({
      comunidad_id: comunidad.id,
      usuario_id: usuarioId,
      rol,
      estado: "activo",
      finca_principal_id: fincaId || null,
    });
    if (errorMiembro) throw new Error("miembro");

    if (telefono) {
      await admin.from("perfiles").update({ telefono }).eq("id", usuarioId);
    }

    if (haySegundoTitular && titular2Correo) {
      const { data: perfilExistente } = await admin
        .from("perfiles")
        .select("id, nombre")
        .ilike("correo", titular2Correo)
        .maybeSingle();

      if (perfilExistente) {
        segundoId = perfilExistente.id;
        aviso = "El segundo titular ya tenía cuenta en Mi Comunidad: no hace falta darle contraseña.";
      } else {
        const contrasenaSegundo = generarContrasenaTemporal();
        const { data: creadoSegundo, error: errorSegundo } =
          await admin.auth.admin.createUser({
            email: titular2Correo,
            password: contrasenaSegundo,
            email_confirm: true,
            user_metadata: { nombre: titular2Nombre },
          });

        if (errorSegundo || !creadoSegundo.user) throw new Error("segundo");
        segundoId = creadoSegundo.user.id;
        segundoCreado = true;
        cuentas.push({
          nombre: titular2Nombre ?? titular2Correo,
          correo: titular2Correo,
          contrasena: contrasenaSegundo,
        });
      }

      // El segundo titular también es miembro: puede entrar y ver su finca.
      await supabase.from("miembros").upsert(
        {
          comunidad_id: comunidad.id,
          usuario_id: segundoId,
          rol: "vecino",
          estado: "activo",
          finca_principal_id: fincaId || null,
        },
        { onConflict: "comunidad_id,usuario_id", ignoreDuplicates: true },
      );
    }

    if (fincaId) {
      const titulares: {
        finca_id: string;
        usuario_id: string | null;
        nombre: string | null;
        tipo: "propietario";
        porcentaje: number;
      }[] = [
        {
          finca_id: fincaId,
          usuario_id: usuarioId,
          nombre,
          tipo: "propietario",
          porcentaje: haySegundoTitular ? 50 : 100,
        },
      ];

      if (haySegundoTitular) {
        titulares.push({
          finca_id: fincaId,
          usuario_id: segundoId,
          nombre: titular2Nombre ?? null,
          tipo: "propietario",
          porcentaje: 50,
        });
      }

      const { error: errorTitulares } = await supabase.from("titulares").insert(titulares);
      if (errorTitulares) throw new Error("titulares");
    }
  } catch {
    if (segundoId && segundoCreado) await admin.auth.admin.deleteUser(segundoId);
    await admin.auth.admin.deleteUser(usuarioId);
    return {
      error: "No se pudo terminar el alta. Inténtalo de nuevo.",
    };
  }

  revalidatePath("/vecinos");
  revalidatePath("/panel");
  revalidatePath("/ajustes");

  return { ok: true, nombre, cuentas, aviso };
}
