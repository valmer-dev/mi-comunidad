// Comprobacion temporal: un vecino ve quien registro cada incidencia.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
const base = process.argv[2] ?? "http://localhost:3000";

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
const cliente = createClient(url, anon, { auth: { persistSession: false } });

const contrasena = "Incidencia-2468";
const sello = String(Date.now()).slice(-8);
const ids = [];
const incidencias = [];
let fallos = 0;
function marcar(texto, condicion) {
  console.log(`  ${condicion ? "ok" : "FALLO"}  ${texto}`);
  if (!condicion) fallos += 1;
}

const { data: comunidad } = await admin.from("comunidades").select("id").limit(1).single();
const { data: fincas } = await admin
  .from("fincas")
  .select("id, codigo")
  .eq("comunidad_id", comunidad.id)
  .order("numero")
  .limit(2);
const fincaReporta = fincas[0];
const fincaVe = fincas[1];

async function crear(nombre, correo, rol, fincaId) {
  const { data, error } = await admin.auth.admin.createUser({
    email: correo,
    password: contrasena,
    email_confirm: true,
    user_metadata: { nombre },
  });
  if (error) throw error;
  ids.push(data.user.id);
  await admin.from("miembros").insert({
    comunidad_id: comunidad.id,
    usuario_id: data.user.id,
    rol,
    estado: "activo",
    finca_principal_id: fincaId,
  });
  return data.user.id;
}

try {
  const nombreReporta = `Ana Reporta ${sello}`;
  const nombreVe = `Luis Mira ${sello}`;
  const reportaId = await crear(
    nombreReporta,
    `reporta-${sello}@example.invalid`,
    "presidente",
    fincaReporta.id,
  );
  await crear(nombreVe, `mira-${sello}@example.invalid`, "vecino", fincaVe.id);

  // Incidencia registrada por "Ana" (no por quien va a mirar)
  const { data: incidencia, error: errorIncidencia } = await admin
    .from("incidencias")
    .insert({
      comunidad_id: comunidad.id,
      titulo: `Fuga en el garaje ${sello}`,
      descripcion: "Prueba de autor de la incidencia.",
      tipo: "fontaneria",
      prioridad: "media",
      reportado_por: reportaId,
    })
    .select("id")
    .single();
  if (errorIncidencia) throw errorIncidencia;
  incidencias.push(incidencia.id);

  // Sesion del vecino que solo mira
  const { data: sesion } = await cliente.auth.signInWithPassword({
    email: `mira-${sello}@example.invalid`,
    password: contrasena,
  });
  const cookie = chunks(
    `sb-${new URL(url).hostname.split(".")[0]}-auth-token`,
    "base64-" + Buffer.from(JSON.stringify(sesion.session), "utf8").toString("base64url"),
  )
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const res = await fetch(base + "/incidencias", { headers: { cookie }, redirect: "manual" });
  const html = await res.text();

  marcar("/incidencias responde 200", res.status === 200);
  marcar("muestra el nombre de quien la registro", html.includes(nombreReporta));
  marcar("muestra la vivienda de quien la registro", html.includes(fincaReporta.codigo));
  marcar("texto 'La registro'", html.includes("La registró"));
} finally {
  for (const id of incidencias) {
    await admin.from("incidencias").delete().eq("id", id);
  }
  for (const id of ids) {
    await admin.auth.admin.deleteUser(id);
  }
  console.log(`Datos de prueba eliminados (${ids.length} usuarios, ${incidencias.length} incidencias)`);
  process.exit(fallos > 0 ? 1 : 0);
}
