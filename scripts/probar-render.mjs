// Comprobacion de render de las rutas privadas con una sesion real.
// Uso: node --env-file=.env.local scripts/_probar-render.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

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

const texto = readFileSync(".secretos/credenciales-presidente.txt", "utf8");
const correo = texto.match(/Correo:\s*(.+)/)?.[1]?.trim();
const contrasena = texto.match(/Contraseña:\s*(.+)/)?.[1]?.trim();

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

const rutas = [
  "/panel",
  "/vecinos",
  "/tablon",
  "/incidencias",
  "/juntas",
  "/finanzas",
  "/documentos",
  "/ajustes",
];

let fallos = 0;
for (const ruta of rutas) {
  const inicio = performance.now();
  const res = await fetch(base + ruta, { headers: { cookie }, redirect: "manual" });
  const html = await res.text();
  const ms = Math.round(performance.now() - inicio);
  const roto =
    /Minified React error/i.test(html) ||
    /An error occurred in the Server Components render/i.test(html) ||
    /Application error/i.test(html);
  if (roto || res.status >= 400) fallos += 1;
  console.log(
    `${ruta.padEnd(14)} ${String(res.status).padEnd(4)} ${String(ms).padStart(5)} ms  ${
      roto ? "FALLO DE RENDER" : res.status < 400 ? "ok" : "ERROR"
    }`,
  );
}

process.exit(fallos > 0 ? 1 : 0);
