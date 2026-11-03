// Comprobacion de los nuevos pisos en la interfaz (usuario temporal).
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
const base = process.argv[2] ?? "http://localhost:3100";

const MAX = 3180;
function chunks(key, value) {
  const encoded = encodeURIComponent(value);
  if (encoded.length <= MAX) return [{ name: key, value: encoded }];
  const out = [];
  let resto = encoded;
  while (resto.length > 0) {
    let head = resto.slice(0, MAX);
    const last = head.lastIndexOf("%");
    if (last > MAX - 3) head = head.slice(0, last);
    out.push(head);
    resto = resto.slice(head.length);
  }
  return out.map((v, i) => ({ name: `${key}.${i}`, value: v }));
}

const admin = createClient(url, servicio, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const contrasena = "Pisos-7531";
const sello = String(Date.now()).slice(-8);
const correo = `prueba-pisos-${sello}@example.invalid`;
const nuevos = ["1ºC", "1ºD", "2ºC", "2ºD", "3ºC", "3ºD"];
let fallos = 0;

function marcar(texto, condicion) {
  console.log(`  ${condicion ? "ok" : "FALLO"}  ${texto}`);
  if (!condicion) fallos += 1;
}

const { data: comunidad } = await admin.from("comunidades").select("id").limit(1).single();
const { data: creado, error } = await admin.auth.admin.createUser({
  email: correo,
  password: contrasena,
  email_confirm: true,
  user_metadata: { nombre: "Prueba Pisos" },
});
if (error) throw error;
await admin.from("miembros").insert({
  comunidad_id: comunidad.id,
  usuario_id: creado.user.id,
  rol: "presidente",
  estado: "activo",
});

try {
  const cliente = createClient(url, anon, { auth: { persistSession: false } });
  const { data: sesion, error: errorLogin } = await cliente.auth.signInWithPassword({
    email: correo,
    password: contrasena,
  });
  if (errorLogin) throw errorLogin;
  const cookie = chunks(
    `sb-${new URL(url).hostname.split(".")[0]}-auth-token`,
    "base64-" + Buffer.from(JSON.stringify(sesion.session), "utf8").toString("base64url"),
  )
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const vecinos = (await fetch(`${base}/vecinos`, { headers: { cookie } }).then((r) => r.text()))
    .replace(/<!--.*?-->/g, "");
  const ajustes = (await fetch(`${base}/ajustes`, { headers: { cookie } }).then((r) => r.text()))
    .replace(/<!--.*?-->/g, "");

  console.log("1. Pagina de vecinos:");
  marcar("se ven las 32 casas y pisos", vecinos.includes("Casas y pisos (32)"));
  for (const codigo of nuevos) {
    marcar(`aparece ${codigo}`, vecinos.includes(codigo));
  }

  console.log("2. Ajustes:");
  marcar("muestra 12 pisos", ajustes.includes("12 pisos"));
  marcar(
    "explica las cuatro puertas por planta",
    ajustes.includes("cuatro puertas por planta"),
  );

  console.log("3. Base de datos:");
  const { data: fincas } = await admin
    .from("fincas")
    .select("codigo, coeficiente")
    .eq("comunidad_id", comunidad.id);
  const suma = (fincas ?? []).reduce((total, finca) => total + Number(finca.coeficiente), 0);
  marcar("hay 32 fincas", (fincas ?? []).length === 32);
  marcar("los coeficientes suman 100", Math.abs(suma - 100) < 0.001);
} catch (error) {
  console.error("ERROR:", error.message);
  fallos += 1;
} finally {
  await admin.auth.admin.deleteUser(creado.user.id);
  console.log("Datos de prueba eliminados (1 usuario)");
  process.exit(fallos > 0 ? 1 : 0);
}
