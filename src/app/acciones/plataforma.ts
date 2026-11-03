"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { obtenerContexto } from "@/lib/auth";
import {
  correoDesdeTelefono,
  esCorreoInterno,
  normalizarTelefono,
  telefonoValido,
} from "@/lib/telefono";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const esquema = z.object({
  nombre: z.string().trim().min(3, "El nombre de la comunidad es obligatorio."),
  direccion: z.string().trim().optional(),
  codigoPostal: z.string().trim().optional(),
  ciudad: z.string().trim().optional(),
  provincia: z.string().trim().optional(),
  numeroCasas: z.coerce
    .number()
    .int("Escribe un número entero de casas.")
    .min(0, "El número de casas no puede ser negativo.")
    .max(500, "Como máximo 500 casas."),
  numeroPisos: z.coerce
    .number()
    .int("Escribe un número entero de pisos.")
    .min(0, "El número de pisos no puede ser negativo.")
    .max(500, "Como máximo 500 pisos."),
});

export type EstadoPlataforma = { error?: string };

/**
 * Crea una comunidad nueva desde /plataforma. Quien la crea queda como
 * presidente y se generan sus casas y pisos.
 */
export async function crearComunidad(
  _estado: EstadoPlataforma,
  datos: FormData,
): Promise<EstadoPlataforma> {
  const { usuario, esAdminPlataforma } = await obtenerContexto();
  if (!esAdminPlataforma) {
    return { error: "Solo el administrador de la plataforma puede crear comunidades." };
  }

  const resultado = esquema.safeParse({
    nombre: datos.get("nombre"),
    direccion: datos.get("direccion"),
    codigoPostal: datos.get("codigoPostal"),
    ciudad: datos.get("ciudad"),
    provincia: datos.get("provincia"),
    numeroCasas: datos.get("numeroCasas"),
    numeroPisos: datos.get("numeroPisos"),
  });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const { nombre, direccion, codigoPostal, ciudad, provincia, numeroCasas, numeroPisos } =
    resultado.data;

  if (numeroCasas + numeroPisos === 0) {
    return { error: "Indica al menos una casa o un piso." };
  }

  const supabase = await crearClienteServidor();

  const { data: comunidad, error } = await supabase
    .from("comunidades")
    .insert({
      nombre,
      direccion: direccion || null,
      codigo_postal: codigoPostal || null,
      ciudad: ciudad || null,
      provincia: provincia || null,
      numero_casas: numeroCasas,
      numero_pisos: numeroPisos,
    })
    .select("id")
    .single();

  if (error || !comunidad) {
    return { error: "No se pudo crear la comunidad." };
  }

  const { error: errorMiembro } = await supabase.from("miembros").insert({
    comunidad_id: comunidad.id,
    usuario_id: usuario.id,
    rol: "presidente",
    estado: "activo",
  });

  if (errorMiembro) {
    await supabase.from("comunidades").delete().eq("id", comunidad.id);
    return { error: "No se pudo añadirte como presidente de la comunidad." };
  }

  const { error: errorFincas } = await supabase.rpc("configurar_fincas", {
    p_comunidad_id: comunidad.id,
    p_casas: numeroCasas,
    p_pisos: numeroPisos,
  });

  if (errorFincas) {
    await supabase.from("comunidades").delete().eq("id", comunidad.id);
    return { error: "No se pudieron crear las casas y los pisos." };
  }

  const almacen = await cookies();
  almacen.set("comunidad_activa", comunidad.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });

  revalidatePath("/", "layout");
  redirect("/panel");
}

/** Cambia la comunidad que se está viendo (solo si se pertenece a ella). */
export async function abrirComunidad(datos: FormData) {
  const { usuario } = await obtenerContexto();
  const comunidadId = String(datos.get("comunidadId") ?? "");
  if (!comunidadId) redirect("/plataforma");

  const supabase = await crearClienteServidor();
  const { data: miembro } = await supabase
    .from("miembros")
    .select("id")
    .eq("usuario_id", usuario.id)
    .eq("comunidad_id", comunidadId)
    .eq("estado", "activo")
    .maybeSingle();

  if (!miembro) redirect("/plataforma");

  const almacen = await cookies();
  almacen.set("comunidad_activa", comunidadId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });

  revalidatePath("/", "layout");
  redirect("/panel");
}

// ------------------------------------------------------------
// Roles
// ------------------------------------------------------------

const esquemaRol = z.object({
  clave: z.enum(["presidente", "vicepresidente", "vocal", "vecino"]),
  nombre: z.string().trim().min(2, "Escribe el nombre del rol."),
  descripcion: z.string().trim().max(400, "La descripción es demasiado larga.").optional(),
});

export type EstadoRol = { error?: string; ok?: boolean };

/** Edita nombre, descripción y permisos de uno de los cuatro roles de la comunidad. */
export async function actualizarRol(
  _estado: EstadoRol,
  datos: FormData,
): Promise<EstadoRol> {
  const { esAdminPlataforma } = await obtenerContexto();
  if (!esAdminPlataforma) {
    return { error: "Solo el administrador de la plataforma puede editar los roles." };
  }

  const clave = String(datos.get("clave") ?? "");
  if (clave === "administrador_plataforma") {
    return { error: "El rol Administrador Plataforma no se puede modificar." };
  }

  const resultado = esquemaRol.safeParse({
    clave,
    nombre: datos.get("nombre"),
    descripcion: datos.get("descripcion") || undefined,
  });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("roles")
    .update({
      nombre: resultado.data.nombre,
      descripcion: resultado.data.descripcion || null,
      administra_comunidad: datos.get("administra_comunidad") === "on",
      gestiona_vecinos: datos.get("gestiona_vecinos") === "on",
      gestiona_documentos: datos.get("gestiona_documentos") === "on",
      gestiona_incidencias: datos.get("gestiona_incidencias") === "on",
      ver_finanzas: datos.get("ver_finanzas") === "on",
    })
    .eq("clave", resultado.data.clave)
    .select("clave")
    .maybeSingle();

  if (error || !data) {
    return { error: "No se pudo guardar el rol." };
  }

  revalidatePath("/plataforma");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------------
// Vecinos
// ------------------------------------------------------------

const telefonoOpcional = z.union([
  z.literal(""),
  z.string().trim().refine(telefonoValido, "Escribe un teléfono válido de 9 cifras."),
]);

const correoOpcional = z.union([
  z.literal(""),
  z.string().trim().toLowerCase().email("El correo no es válido."),
]);

const ROLES_EDITABLES = [
  "presidente",
  "vicepresidente",
  "vocal",
  "vecino",
  "secretario",
  "propietario",
  "inquilino",
  "administrador_fincas",
  "administrador_plataforma",
] as const;

const esquemaVecino = z.object({
  miembroId: z.string().uuid("Vecino no válido."),
  nombre: z.string().trim().min(2, "Escribe el nombre."),
  apellidos: z.string().trim().max(120, "Los apellidos son demasiado largos.").optional(),
  telefono: telefonoOpcional.optional(),
  correo: correoOpcional.optional(),
  rol: z.enum(ROLES_EDITABLES),
  fincaId: z.string().uuid().optional().or(z.literal("")),
});

export type EstadoVecinoPlataforma = { error?: string; ok?: boolean };

/** Recalcula el porcentaje de los titulares de una finca a partes iguales. */
async function repartirPorcentajes(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  fincaIds: string[],
) {
  for (const fincaId of fincaIds) {
    const { data: filas } = await supabase
      .from("titulares")
      .select("id")
      .eq("finca_id", fincaId)
      .order("creado_en", { ascending: true });

    if (!filas || filas.length === 0) continue;

    const base = Math.floor((100 / filas.length) * 100) / 100;
    let acumulado = 0;

    for (let indice = 0; indice < filas.length; indice += 1) {
      const esUltimo = indice === filas.length - 1;
      const porcentaje = esUltimo ? Number((100 - acumulado).toFixed(2)) : base;
      await supabase
        .from("titulares")
        .update({ porcentaje })
        .eq("id", filas[indice].id);
      acumulado += porcentaje;
    }
  }
}

/** Edita los datos, el rol y la vivienda de un vecino de la comunidad activa. */
export async function actualizarVecino(
  _estado: EstadoVecinoPlataforma,
  datos: FormData,
): Promise<EstadoVecinoPlataforma> {
  const { usuario, esAdminPlataforma, comunidad } = await obtenerContexto();
  if (!esAdminPlataforma) {
    return { error: "Solo el administrador de la plataforma puede editar vecinos." };
  }
  if (!comunidad) {
    return { error: "Selecciona una comunidad para gestionar sus vecinos." };
  }

  const resultado = esquemaVecino.safeParse({
    miembroId: datos.get("miembroId"),
    nombre: datos.get("nombre"),
    apellidos: datos.get("apellidos") || undefined,
    telefono: datos.get("telefono") || "",
    correo: datos.get("correo") || "",
    rol: datos.get("rol"),
    fincaId: datos.get("fincaId") || "",
  });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const { miembroId, nombre, apellidos, rol, fincaId } = resultado.data;
  const telefono = resultado.data.telefono
    ? normalizarTelefono(resultado.data.telefono)
    : null;
  const correo = resultado.data.correo ? resultado.data.correo.toLowerCase() : null;

  if (correo && esCorreoInterno(correo)) {
    return { error: "Ese correo no es válido." };
  }

  const supabase = await crearClienteServidor();
  const { data: miembro, error: errorMiembro } = await supabase
    .from("miembros")
    .select("id, usuario_id, rol, finca_principal_id")
    .eq("id", miembroId)
    .eq("comunidad_id", comunidad.id)
    .maybeSingle();

  if (errorMiembro || !miembro) {
    return { error: "Ese vecino no pertenece a la comunidad activa." };
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, correo, telefono, es_admin_plataforma")
    .eq("id", miembro.usuario_id)
    .maybeSingle();

  if (!perfil) {
    return { error: "No se encontró la cuenta del vecino." };
  }

  if (fincaId) {
    const { data: finca } = await supabase
      .from("fincas")
      .select("id")
      .eq("id", fincaId)
      .eq("comunidad_id", comunidad.id)
      .maybeSingle();

    if (!finca) {
      return { error: "La vivienda seleccionada no pertenece a la comunidad." };
    }
  }

  if (telefono) {
    const { data: repetido } = await supabase
      .from("perfiles")
      .select("id")
      .eq("telefono", telefono)
      .neq("id", miembro.usuario_id)
      .limit(1)
      .maybeSingle();

    if (repetido) {
      return { error: "Ese teléfono ya está en uso por otra persona." };
    }
  }

  if (correo) {
    const { data: repetido } = await supabase
      .from("perfiles")
      .select("id")
      .ilike("correo", correo)
      .neq("id", miembro.usuario_id)
      .limit(1)
      .maybeSingle();

    if (repetido) {
      return { error: "Ese correo ya está en uso por otra persona." };
    }
  }

  const esAdminElegido = rol === "administrador_plataforma";

  if (
    !esAdminElegido &&
    perfil.es_admin_plataforma &&
    miembro.usuario_id === usuario.id
  ) {
    return {
      error: "No puedes quitarte tu propio acceso de administrador de plataforma.",
    };
  }

  const nuevoRol = esAdminElegido ? miembro.rol : rol;
  const admin = crearClienteAdmin();

  const { data: datosAuth } = await admin.auth.admin.getUserById(miembro.usuario_id);
  const correoAuthActual = datosAuth?.user?.email ?? null;
  let correoAuthDeseado = correo ?? "";

  if (!correoAuthDeseado && telefono && esCorreoInterno(correoAuthActual)) {
    correoAuthDeseado = correoDesdeTelefono(telefono);
  }

  if (
    correoAuthDeseado &&
    correoAuthDeseado.toLowerCase() !== (correoAuthActual ?? "").toLowerCase()
  ) {
    const { error: errorAuth } = await admin.auth.admin.updateUserById(
      miembro.usuario_id,
      {
        email: correoAuthDeseado,
        email_confirm: true,
      },
    );

    if (errorAuth) {
      return {
        error: "No se pudo actualizar el correo de acceso: puede estar en uso.",
      };
    }
  }

  const { error: errorPerfil } = await supabase
    .from("perfiles")
    .update({
      nombre,
      apellidos: apellidos || null,
      telefono,
      correo,
      es_admin_plataforma: esAdminElegido,
    })
    .eq("id", miembro.usuario_id);

  if (errorPerfil) {
    return { error: "No se pudieron guardar los datos del vecino." };
  }

  const { error: errorUpdate } = await supabase
    .from("miembros")
    .update({
      rol: nuevoRol,
      finca_principal_id: fincaId || null,
    })
    .eq("id", miembroId);

  if (errorUpdate) {
    return { error: "No se pudo actualizar el rol o la vivienda." };
  }

  // Mantener las titularidades enlazadas con la vivienda elegida.
  const { data: fincasComunidad } = await supabase
    .from("fincas")
    .select("id")
    .eq("comunidad_id", comunidad.id);

  const idsFincas = (fincasComunidad ?? []).map((finca) => finca.id);

  if (idsFincas.length > 0) {
    const { data: titularesActuales } = await supabase
      .from("titulares")
      .select("id, finca_id")
      .eq("usuario_id", miembro.usuario_id)
      .in("finca_id", idsFincas);

    const afectadas = new Set<string>();

    for (const titular of titularesActuales ?? []) {
      if (titular.finca_id !== (fincaId || null)) {
        await supabase.from("titulares").delete().eq("id", titular.id);
        afectadas.add(titular.finca_id);
      }
    }

    if (fincaId) {
      afectadas.add(fincaId);
      const actual = (titularesActuales ?? []).find(
        (titular) => titular.finca_id === fincaId,
      );

      if (actual) {
        await supabase
          .from("titulares")
          .update({ nombre, tipo: "propietario" })
          .eq("id", actual.id);
      } else {
        const { error: errorTitular } = await supabase.from("titulares").insert({
          finca_id: fincaId,
          usuario_id: miembro.usuario_id,
          nombre,
          tipo: "propietario",
          porcentaje: 100,
        });

        if (errorTitular) {
          return { error: "No se pudo actualizar la vivienda del vecino." };
        }
      }
    }

    await repartirPorcentajes(supabase, [...afectadas]);
  }

  revalidatePath("/plataforma");
  revalidatePath("/vecinos");
  revalidatePath("/panel");
  revalidatePath("/ajustes");
  return { ok: true };
}

/** Elimina a un vecino de la comunidad activa y, si procede, su cuenta. */
export async function eliminarVecino(
  _estado: EstadoVecinoPlataforma,
  datos: FormData,
): Promise<EstadoVecinoPlataforma> {
  const { usuario, esAdminPlataforma, comunidad } = await obtenerContexto();
  if (!esAdminPlataforma) {
    return { error: "Solo el administrador de la plataforma puede eliminar vecinos." };
  }
  if (!comunidad) {
    return { error: "Selecciona una comunidad para gestionar sus vecinos." };
  }

  const miembroId = String(datos.get("miembroId") ?? "");
  if (!z.string().uuid().safeParse(miembroId).success) {
    return { error: "Vecino no válido." };
  }

  const supabase = await crearClienteServidor();
  const { data: miembro } = await supabase
    .from("miembros")
    .select("id, usuario_id")
    .eq("id", miembroId)
    .eq("comunidad_id", comunidad.id)
    .maybeSingle();

  if (!miembro) {
    return { error: "Ese vecino no pertenece a la comunidad activa." };
  }

  if (miembro.usuario_id === usuario.id) {
    return { error: "No puedes eliminarte a ti mismo desde este panel." };
  }

  const { data: fincas } = await supabase
    .from("fincas")
    .select("id")
    .eq("comunidad_id", comunidad.id);

  const idsFincas = (fincas ?? []).map((finca) => finca.id);

  if (idsFincas.length > 0) {
    await supabase
      .from("titulares")
      .delete()
      .eq("usuario_id", miembro.usuario_id)
      .in("finca_id", idsFincas);
  }

  const { error: errorBaja } = await supabase
    .from("miembros")
    .delete()
    .eq("id", miembroId);

  if (errorBaja) {
    return { error: "No se pudo eliminar al vecino de la comunidad." };
  }

  const { count: otrasComunidades } = await supabase
    .from("miembros")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", miembro.usuario_id);

  if ((otrasComunidades ?? 0) === 0) {
    const { count: otrosTitulos } = await supabase
      .from("titulares")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", miembro.usuario_id);

    if ((otrosTitulos ?? 0) === 0) {
      const admin = crearClienteAdmin();
      await admin.auth.admin.deleteUser(miembro.usuario_id);
    }
  }

  revalidatePath("/plataforma");
  revalidatePath("/vecinos");
  revalidatePath("/panel");
  revalidatePath("/ajustes");
  return { ok: true };
}
