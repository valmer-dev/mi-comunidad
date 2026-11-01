import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const texto = readFileSync(".secretos/credenciales-presidente.txt", "utf8");
const correo = texto.match(/Correo:\s*(.+)/)?.[1]?.trim();
const contrasena = texto.match(/Contraseña:\s*(.+)/)?.[1]?.trim();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const { data, error } = await supabase.auth.signInWithPassword({
  email: correo,
  password: contrasena,
});

console.log("Inicio de sesión:", data.session ? "correcto" : "fallido", error?.message ?? "");

if (data.session) {
  const [{ count: comunidades }, { count: miembros }, { data: yo }] = await Promise.all([
    supabase.from("comunidades").select("*", { count: "exact", head: true }),
    supabase.from("miembros").select("*", { count: "exact", head: true }),
    supabase.from("miembros").select("rol, comunidades(nombre)").limit(1).maybeSingle(),
  ]);

  console.log("Comunidades visibles:", comunidades);
  console.log("Miembros visibles:", miembros);
  console.log("Rol:", yo?.rol ?? "sin rol");
  console.log("Comunidad:", yo?.comunidades?.nombre ?? "—");
}
