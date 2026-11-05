"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirContexto } from "@/lib/auth";
import {
  buscarPerfilPorContacto,
  crearCuentaVecino,
  type CuentaCreada,
} from "@/lib/alta-vecinos";
import { puedeGestionarVecinos } from "@/lib/permisos";
import { asegurarMiembroComunidad } from "@/lib/miembros";
import { repartirPorcentajes } from "@/lib/titulares";
import {
  esCorreoInterno,
  normalizarTelefono,
  telefonoValido,
} from "@/lib/telefono";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type { CuentaCreada } from "@/lib/alta-vecinos";

const telefonoObligatorio = z
  .string()
  .trim()
  .min(1, "Escribe el teléfono.")
  .refine(telefonoValido, "Escribe un teléfono válido de 9 cifras.");

const telefonoOpcional = z.union([
  z.literal(""),
  z.string().trim().refine(telefonoValido, "Escribe un teléfono válido de 9 cifras."),
]);

const correoOpcional = z.union([
  z.literal(""),
  z.string().trim().toLowerCase().email("El correo no es válido."),
]);

const esquema = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre."),
  telefono: telefonoObligatorio,
  correo: correoOpcional.optional(),
  rol: z.enum([
    "presidente",
    "vicepresidente",
    "vocal",
    "vecino",
    "administrador_plataforma",
  ]),
  fincaId: z.string().uuid().optional().or(z.literal("")),
  titular2Nombre: z.string().trim().optional(),
  titular2Telefono: telefonoOpcional.optional(),
  titular2Correo: correoOpcional.optional(),
});

export type EstadoVecino =
  | { error?: string }
  | {
      ok: true;
      nombre: string;
      cuentas: CuentaCreada[];
      /** Aviso para quien ya tenia cuenta y no necesita contrasena nueva. */
      aviso?: string;
      fincaCodigo: string | null;
    };

/** Error de validacion detectado despues de haber creado alguna cuenta. */
class ErrorAlta extends Error {}

/**
 * Da de alta a un vecino usando el telefono como identificador. El correo es
 * opcional. Si se indica un segundo titular, se le crea (o reutiliza) su
 * cuenta para que tambien pueda entrar.
 */
export async function crearVecino(
  _estado: EstadoVecino,
  datos: FormData,
): Promise<EstadoVecino> {
  const { comunidad, permisos } = await requerirContexto();
  if (!puedeGestionarVecinos(permisos)) {
    return { error: "No tienes permiso para añadir vecinos." };
  }

  const resultado = esquema.safeParse({
    nombre: datos.get("nombre"),
    telefono: datos.get("telefono"),
    correo: datos.get("correo") || "",
    rol: datos.get("rol"),
    fincaId: datos.get("fincaId") || "",
    titular2Nombre: datos.get("titular2Nombre") || undefined,
    titular2Telefono: datos.get("titular2Telefono") || "",
    titular2Correo: datos.get("titular2Correo") || "",
  });

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const { nombre, fincaId, titular2Nombre } = resultado.data;
  const esAdminPlataformaNuevo = resultado.data.rol === "administrador_plataforma";
  const rol =
    resultado.data.rol === "administrador_plataforma"
      ? "vecino"
      : resultado.data.rol;
  const telefono = normalizarTelefono(resultado.data.telefono);
  const correo = resultado.data.correo ? resultado.data.correo : null;
  const titular2Telefono = resultado.data.titular2Telefono
    ? normalizarTelefono(resultado.data.titular2Telefono)
    : null;
  const titular2Correo = resultado.data.titular2Correo
    ? resultado.data.titular2Correo
    : null;

  if (correo && esCorreoInterno(correo)) {
    return { error: "Ese correo no es válido." };
  }
  if (titular2Correo && esCorreoInterno(titular2Correo)) {
    return { error: "El correo del segundo titular no es válido." };
  }

  const haySegundoTitular = Boolean(
    titular2Nombre || titular2Telefono || titular2Correo,
  );
  const haySegundoContacto = Boolean(titular2Telefono || titular2Correo);

  if (haySegundoTitular && !fincaId) {
    return { error: "Elige la casa o el piso para poder añadir titulares." };
  }
  if (haySegundoContacto && !titular2Nombre) {
    return { error: "Escribe el nombre del segundo titular." };
  }
  if (titular2Correo && titular2Correo === correo) {
    return { error: "El segundo titular no puede tener el mismo correo que el primero." };
  }
  if (titular2Telefono && titular2Telefono === telefono) {
    return { error: "El segundo titular no puede tener el mismo teléfono que el primero." };
  }

  const admin = crearClienteAdmin();
  const supabase = await crearClienteServidor();
  const cuentas: CuentaCreada[] = [];
  const avisos: string[] = [];
  const creados: string[] = [];
  let fincaCodigo: string | null = null;

  try {
    // --- Titular principal ---
    const busqueda = await buscarPerfilPorContacto(admin, telefono, correo);
    if (busqueda.conflicto) {
      return { error: "Ese teléfono y ese correo pertenecen a cuentas distintas." };
    }

    let usuarioId: string;

    if (busqueda.perfil) {
      const { data: yaEsMiembro } = await supabase
        .from("miembros")
        .select("id")
        .eq("comunidad_id", comunidad.id)
        .eq("usuario_id", busqueda.perfil.id)
        .maybeSingle();

      if (yaEsMiembro) {
        return { error: "Esa persona ya está en la comunidad." };
      }

      usuarioId = busqueda.perfil.id;
      avisos.push("Esa persona ya tenía cuenta: entra con su contraseña actual.");
      await admin.from("perfiles").update({ telefono }).eq("id", usuarioId);
    } else {
      const creada = await crearCuentaVecino(admin, { nombre, telefono, correo });
      if ("error" in creada) {
        return { error: "No se pudo crear la cuenta. Inténtalo de nuevo." };
      }
      usuarioId = creada.usuarioId;
      creados.push(usuarioId);
      cuentas.push(creada.cuenta);
    }

    if (esAdminPlataformaNuevo) {
      const { error: errorFlag } = await admin
        .from("perfiles")
        .update({ es_admin_plataforma: true })
        .eq("id", usuarioId);
      if (errorFlag) throw new Error("perfil");
    }

    const { error: errorMiembro } = await supabase.from("miembros").insert({
      comunidad_id: comunidad.id,
      usuario_id: usuarioId,
      rol,
      estado: "activo",
      finca_principal_id: fincaId || null,
    });
    if (errorMiembro) throw new Error("miembro");

    // --- Segundo titular ---
    let segundoId: string | null = null;

    if (haySegundoTitular && haySegundoContacto) {
      const busqueda2 = await buscarPerfilPorContacto(
        admin,
        titular2Telefono,
        titular2Correo,
      );
      if (busqueda2.conflicto) {
        throw new ErrorAlta(
          "El teléfono y el correo del segundo titular son de cuentas distintas.",
        );
      }

      if (busqueda2.perfil) {
        segundoId = busqueda2.perfil.id;
        if (segundoId === usuarioId) {
          throw new ErrorAlta(
            "El segundo titular no puede ser la misma persona que el primero.",
          );
        }
        avisos.push(
          "El segundo titular ya tenía cuenta: puede entrar con su contraseña actual.",
        );
        if (titular2Telefono) {
          await admin.from("perfiles").update({ telefono: titular2Telefono }).eq("id", segundoId);
        }
      } else {
        const creada2 = await crearCuentaVecino(admin, {
          nombre: titular2Nombre ?? "",
          telefono: titular2Telefono,
          correo: titular2Correo,
        });
        if ("error" in creada2) throw new Error("segundo");
        segundoId = creada2.usuarioId;
        creados.push(segundoId);
        cuentas.push(creada2.cuenta);
      }

      // El segundo titular tambien es miembro: puede entrar y ver su finca.
      const miembroSegundo = await asegurarMiembroComunidad(supabase, {
        comunidadId: comunidad.id,
        usuarioId: segundoId,
        fincaId: fincaId || null,
      });
      if (!miembroSegundo) throw new Error("miembro2");
    }

    // --- Finca y titulares ---
    if (fincaId) {
      const { data: finca } = await supabase
        .from("fincas")
        .select("codigo")
        .eq("id", fincaId)
        .eq("comunidad_id", comunidad.id)
        .maybeSingle();
      fincaCodigo = finca?.codigo ?? null;

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

      await repartirPorcentajes(supabase, [fincaId]);
    }
  } catch (error) {
    for (const creado of creados.reverse()) {
      await admin.auth.admin.deleteUser(creado);
    }
    if (error instanceof ErrorAlta) return { error: error.message };
    return { error: "No se pudo terminar el alta. Inténtalo de nuevo." };
  }

  revalidatePath("/vecinos");
  revalidatePath("/panel");
  revalidatePath("/ajustes");
  revalidatePath("/plataforma");

  return {
    ok: true,
    nombre,
    cuentas,
    aviso: avisos.join(" ") || undefined,
    fincaCodigo,
  };
}
