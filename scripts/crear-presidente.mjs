import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !clave) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const correo = (process.argv[2] ?? "jcvalverde1996@gmail.com").toLowerCase();
const nombre = process.argv[3] ?? "Juan Carlos";
const contrasena = randomBytes(9).toString("base64url");

const admin = createClient(url, clave, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: lista } = await admin.auth.admin.listUsers();
let usuario = lista?.users.find((u) => u.email?.toLowerCase() === correo);

if (!usuario) {
  const { data, error } = await admin.auth.admin.createUser({
    email: correo,
    password: contrasena,
    email_confirm: true,
    user_metadata: { nombre },
  });
  if (error) {
    console.error("No se pudo crear el usuario:", error.message);
    process.exit(1);
  }
  usuario = data.user;
  console.log("Usuario creado.");
} else {
  const { error } = await admin.auth.admin.updateUserById(usuario.id, {
    password: contrasena,
    email_confirm: true,
  });
  if (error) {
    console.error("No se pudo actualizar la contraseña:", error.message);
    process.exit(1);
  }
  console.log("El usuario ya existía: contraseña regenerada.");
}

await admin.from("perfiles").upsert({
  id: usuario.id,
  nombre,
  correo,
});

const { data: comunidad } = await admin
  .from("comunidades")
  .select("id")
  .limit(1)
  .maybeSingle();

if (!comunidad) {
  console.error("No hay ninguna comunidad creada.");
  process.exit(1);
}

const { error: errorMiembro } = await admin.from("miembros").upsert(
  {
    comunidad_id: comunidad.id,
    usuario_id: usuario.id,
    rol: "presidente",
    estado: "activo",
  },
  { onConflict: "comunidad_id,usuario_id" },
);

if (errorMiembro) {
  console.error("No se pudo asignar el rol:", errorMiembro.message);
  process.exit(1);
}

mkdirSync(".secretos", { recursive: true });
const ruta = join(".secretos", "credenciales-presidente.txt");
writeFileSync(
  ruta,
  `Acceso a Mi Comunidad\nCorreo: ${correo}\nContraseña: ${contrasena}\n`,
  "utf8",
);

console.log(`Presidente listo. Credenciales guardadas en ${ruta}`);
