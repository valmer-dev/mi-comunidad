// Comprobacion de render de las rutas privadas con una sesion real.
// Verifica estado, tiempo de respuesta y que el HTML contiene el contenido
// esperado de cada pagina (no una redireccion al login).
//
// Uso: node --env-file=.env.local scripts/probar-render.mjs [url-base]
//
// Credenciales: variables COMUNIDAD_CORREO y COMUNIDAD_CONTRASENA, o el
// fichero .secretos/credenciales-presidente.txt.
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

const MAX_CHUNK_SIZE = 3180;

function createChunks(key, value, chunkSize = MAX_CHUNK_SIZE) {
  let encodedValue = encodeURIComponent(value);
  if (encodedValue.length <= chunkSize) return [{ name: key, value }];
  const chunks = [];
  while (encodedValue.length > 0) {
    let head = encodedValue.slice(0, chunkSize);
    const lastEscape = head.lastIndexOf("%");
    if (lastEscape > chunkSize - 3) head = head.slice(0, lastEscape);
    let valueHead = "";
    while (head.length > 0) {
      try {
        valueHead = decodeURIComponent(head);
        break;
      } catch (error) {
        if (error instanceof URIError && head.at(-3) === "%" && head.length > 3) {
          head = head.slice(0, head.length - 3);
        } else {
          throw error;
        }
      }
    }
    chunks.push(valueHead);
    encodedValue = encodedValue.slice(head.length);
  }
  return chunks.map((v, i) => ({ name: `${key}.${i}`, value: v }));
}

const rutaCredenciales = ".secretos/credenciales-presidente.txt";
const texto = existsSync(rutaCredenciales) ? readFileSync(rutaCredenciales, "utf8") : "";
const correo = process.env.COMUNIDAD_CORREO ?? texto.match(/Correo:\s*(.+)/)?.[1]?.trim();
const contrasena =
  process.env.COMUNIDAD_CONTRASENA ?? texto.match(/Contraseña:\s*(.+)/)?.[1]?.trim();

if (!correo || !contrasena) {
  console.error(
    "Faltan credenciales: define COMUNIDAD_CORREO y COMUNIDAD_CONTRASENA.",
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const base = process.argv[2] ?? "http://localhost:3000";

const supabase = createClient(url, anon);
const { data, error } = await supabase.auth.signInWithPassword({
  email: correo,
  password: contrasena,
});

if (error || !data.session) {
  console.error("No se pudo iniciar sesion:", error?.message);
  process.exit(1);
}

const ref = new URL(url).hostname.split(".")[0];
const key = `sb-${ref}-auth-token`;
const value = "base64-" + Buffer.from(JSON.stringify(data.session), "utf8").toString("base64url");
const cookie = createChunks(key, value)
  .map((c) => `${c.name}=${c.value}`)
  .join("; ");

// Marcador que solo aparece si la pagina se ha renderizado de verdad.
const rutas = [
  ["/panel", "Hola,"],
  ["/vecinos", "personas en la comunidad"],
  ["/tablon", "Avisos y comunicados"],
  ["/incidencias", "Averías y problemas del edificio"],
  ["/juntas", "Convocatorias, puntos del día y acuerdos"],
  ["/finanzas", "Ejercicio"],
  ["/documentos", "Estatutos, actas, contratos y certificados"],
  ["/ajustes", "Datos de la comunidad y de tu cuenta"],
  ["/plataforma", "Nueva comunidad"],
];

let fallos = 0;
for (const [ruta, marcador] of rutas) {
  const inicio = performance.now();
  const res = await fetch(base + ruta, { headers: { cookie }, redirect: "manual" });
  const html = await res.text();
  const ms = Math.round(performance.now() - inicio);

  const roto =
    /Minified React error/i.test(html) ||
    /An error occurred in the Server Components render/i.test(html) ||
    /Application error/i.test(html);
  const contienePagina = html.includes(marcador);
  const bien = res.status === 200 && contienePagina && !roto;
  if (!bien) fallos += 1;

  console.log(
    `${ruta.padEnd(14)} ${String(res.status).padEnd(4)} ${String(ms).padStart(5)} ms  ${
      bien ? "ok" : roto ? "FALLO DE RENDER" : !contienePagina ? "SIN CONTENIDO ESPERADO" : "ERROR"
    }`,
  );
}

process.exit(fallos > 0 ? 1 : 0);
