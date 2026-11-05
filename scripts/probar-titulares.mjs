// Comprueba de punta a punta la segunda titularidad: dos personas comparten
// vivienda, cada una entra con su telefono, y un titular antiguo sin cuenta
// puede recibir acceso despues desde /plataforma.
//
// Uso: node --env-file=.env.local scripts/probar-titulares.mjs [url]
// Crea datos temporales y los borra al terminar (incluso si algo falla).
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const base = process.argv[2] ?? "http://localhost:3000";
const marca = Date.now();
const correoAdmin = `admin-prueba-${marca}@example.com`;
const contrasenaAdmin = `Admin-${Math.random().toString(36).slice(2)}-A1`;
const telefono1 = "611000111";
const telefono2 = "622000222";

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
let comunidadId = null;
let fincaId = null;
let adminId = null;
let segundoId = null;
let chrome = null;

function comprobar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
  console.log(`  ok  ${mensaje}`);
}

async function borrarUsuariosDePrueba() {
  const { data: restos } = await admin
    .from("perfiles")
    .select("id")
    .in("telefono", [telefono1, telefono2]);
  for (const resto of restos ?? []) {
    await admin.auth.admin.deleteUser(resto.id).catch(() => {});
  }
}

async function main() {
  console.log(`Prueba de segunda titularidad ${marca}`);

  await borrarUsuariosDePrueba();

  // Comunidad temporal, vivienda y administrador de plataforma.
  const { data: comunidad, error: eComunidad } = await admin
    .from("comunidades")
    .insert({
      nombre: `Comunidad Prueba ${marca}`,
      numero_casas: 1,
      numero_pisos: 0,
    })
    .select("id")
    .single();
  if (eComunidad) throw new Error(`Comunidad: ${eComunidad.message}`);
  comunidadId = comunidad.id;

  const { data: finca, error: eFinca } = await admin
    .from("fincas")
    .insert({
      comunidad_id: comunidadId,
      codigo: "Casa 1",
      tipo: "casa",
      coeficiente: 100,
    })
    .select("id")
    .single();
  if (eFinca) throw new Error(`Finca: ${eFinca.message}`);
  fincaId = finca.id;

  const { data: usuarioAdmin, error: eAdmin } = await admin.auth.admin.createUser({
    email: correoAdmin,
    password: contrasenaAdmin,
    email_confirm: true,
    user_metadata: { nombre: "Admin Prueba" },
  });
  if (eAdmin || !usuarioAdmin.user) throw new Error(eAdmin?.message);
  adminId = usuarioAdmin.user.id;

  await admin.from("perfiles").update({ es_admin_plataforma: true }).eq("id", adminId);
  const { error: eMiembroAdmin } = await admin.from("miembros").insert({
    comunidad_id: comunidadId,
    usuario_id: adminId,
    rol: "presidente",
    estado: "activo",
  });
  if (eMiembroAdmin) throw new Error(eMiembroAdmin.message);

  // Chrome headless para recorrer la interfaz real.
  chrome = spawn(
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    [
      "--headless=new",
      "--remote-debugging-port=9334",
      `--user-data-dir=${process.env.TEMP}\\chrome-titulares-${marca}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let destino = null;
  for (let intento = 0; intento < 40 && !destino; intento += 1) {
    await dormir(250);
    try {
      const res = await fetch("http://127.0.0.1:9334/json/new?about:blank", {
        method: "PUT",
      });
      if (res.ok) destino = await res.json();
    } catch {
      // Aun arrancando.
    }
  }
  if (!destino) throw new Error("Chrome no arrancó.");

  const ws = new WebSocket(destino.webSocketDebuggerUrl);
  await new Promise((resolver, rechazar) => {
    ws.onopen = resolver;
    ws.onerror = rechazar;
  });

  let siguienteId = 0;
  const pendientes = new Map();
  ws.onmessage = (evento) => {
    const mensaje = JSON.parse(evento.data);
    if (
      mensaje.method === "Runtime.consoleAPICalled" &&
      mensaje.params.type === "error"
    ) {
      console.log(
        "  consola:",
        mensaje.params.args.map((arg) => arg.value ?? arg.description).join(" "),
      );
    }
    const pendiente = pendientes.get(mensaje.id);
    if (!pendiente) return;
    pendientes.delete(mensaje.id);
    if (mensaje.error) pendiente.rechazar(new Error(mensaje.error.message));
    else pendiente.resolver(mensaje.result);
  };

  function enviar(metodo, params = {}) {
    siguienteId += 1;
    const id = siguienteId;
    return new Promise((resolver, rechazar) => {
      pendientes.set(id, { resolver, rechazar });
      ws.send(JSON.stringify({ id, method: metodo, params }));
    });
  }

  await enviar("Runtime.enable");
  await enviar("Network.enable");

  async function evaluar(expresion) {
    const resultado = await enviar("Runtime.evaluate", {
      expression: expresion,
      awaitPromise: true,
      returnByValue: true,
    });
    if (resultado.exceptionDetails) {
      throw new Error(resultado.exceptionDetails.exception?.description ?? "Error JS");
    }
    return resultado.result?.value;
  }

  async function ir(ruta) {
    await enviar("Page.navigate", { url: base + ruta });
    for (let intento = 0; intento < 60; intento += 1) {
      await dormir(250);
      const listo = await evaluar("document.readyState === 'complete'").catch(
        () => false,
      );
      if (listo) break;
    }
    for (let intento = 0; intento < 40; intento += 1) {
      const hidratado = await evaluar(`(() => {
        const nodo = document.querySelector('form, button, li');
        return Boolean(nodo && Object.keys(nodo).some((clave) => clave.startsWith('__reactProps$')));
      })()`).catch(() => false);
      if (hidratado) break;
      await dormir(250);
    }
    await dormir(500);
  }

  async function entrar(identificador, contrasena) {
    await enviar("Network.clearBrowserCookies");
    await ir("/entrar");
    await evaluar(`(() => {
      document.querySelector('input[name="identificador"]').value = ${JSON.stringify(identificador)};
      document.querySelector('input[name="contrasena"]').value = ${JSON.stringify(contrasena)};
      document.querySelector('form').requestSubmit();
    })()`);
    await dormir(4500);
    const dentro = await evaluar("!document.querySelector('input[name=\"contrasena\"]')");
    const ruta = await evaluar("location.pathname");
    if (!dentro) {
      const error = await evaluar(
        "document.querySelector('.bg-red-50')?.textContent ?? document.body.innerText.slice(0, 300)",
      );
      console.log(`  login ${identificador}: ${ruta} -> ${String(error).trim()}`);
    }
    return { dentro, ruta };
  }

  function leerCredenciales(selectorContenedor) {
    return evaluar(`(() => {
      const contenedor = [...document.querySelectorAll('div')].find((div) =>
        (div.textContent ?? '').includes(${JSON.stringify(selectorContenedor)}) &&
        div.querySelectorAll('.rounded-lg.bg-white').length > 0,
      );
      if (!contenedor) return [];
      return [...contenedor.querySelectorAll('.rounded-lg.bg-white')].map((bloque) => {
        const parrafos = [...bloque.querySelectorAll('p')].map(
          (parrafo) => (parrafo.textContent ?? '').trim(),
        );
        const valor = (etiqueta) => {
          const encontrado = parrafos.find((texto) => texto.startsWith(etiqueta));
          return encontrado ? encontrado.slice(etiqueta.length).trim() : '';
        };
        return {
          nombre: parrafos[0] ?? '',
          telefono: valor('Teléfono:'),
          contrasena: valor('Contraseña:'),
        };
      });
    })()`);
  }

  // 1. Alta con titular y segundo titular desde la interfaz.
  const sesionAdmin = await entrar(correoAdmin, contrasenaAdmin);
  comprobar(sesionAdmin.dentro, "el administrador temporal inicia sesión");

  await ir("/plataforma");
  const abierto = await evaluar(`(() => {
    const boton = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('adir vecino'),
    );
    if (!boton) return false;
    boton.click();
    return true;
  })()`);
  comprobar(abierto === true, "se abre el formulario de nuevo vecino");
  await dormir(800);

  const rellenado = await evaluar(`(() => {
    const form = document.querySelector('form:has(input[name="titular2Telefono"])');
    if (!form) return 'sin-formulario';
    form.querySelector('input[name="nombre"]').value = 'Titular Uno';
    form.querySelector('input[name="telefono"]').value = ${JSON.stringify(telefono1)};
    form.querySelector('select[name="fincaId"]').value = ${JSON.stringify(fincaId)};
    form.querySelector('input[name="titular2Nombre"]').value = 'Titular Dos';
    form.querySelector('input[name="titular2Telefono"]').value = ${JSON.stringify(telefono2)};
    form.requestSubmit();
    return 'enviado';
  })()`);
  comprobar(rellenado === "enviado", "se envían los dos titulares");
  await dormir(5000);

  const credenciales = await leerCredenciales("Cuentas creadas para los dos titulares");
  comprobar(credenciales.length === 2, "la interfaz muestra las dos cuentas creadas");
  const cuenta1 = credenciales.find((cuenta) => cuenta.telefono.includes("611"));
  const cuenta2 = credenciales.find((cuenta) => cuenta.telefono.includes("622"));
  comprobar(Boolean(cuenta1?.contrasena), "credenciales del primer titular");
  comprobar(Boolean(cuenta2?.contrasena), "credenciales del segundo titular");

  const { data: miembros } = await admin
    .from("miembros")
    .select("usuario_id, finca_principal_id")
    .eq("comunidad_id", comunidadId);
  const miembrosVivienda = (miembros ?? []).filter(
    (miembro) => miembro.finca_principal_id === fincaId,
  );
  comprobar(miembrosVivienda.length === 2, "hay dos miembros en la vivienda");
  comprobar(
    (miembros ?? []).length === 3,
    "están el administrador y los dos titulares",
  );

  const { data: titulares } = await admin
    .from("titulares")
    .select("usuario_id, porcentaje")
    .eq("finca_id", fincaId);
  comprobar((titulares ?? []).length === 2, "hay dos titulares en la vivienda");
  comprobar(
    (titulares ?? []).every((titular) => Number(titular.porcentaje) === 50),
    "los porcentajes quedan al 50 %",
  );

  // 2. Cada titular entra con su propio telefono.
  const entrada1 = await entrar(telefono1, cuenta1.contrasena);
  comprobar(entrada1.dentro, "el primer titular entra con su teléfono");
  const html1 = await evaluar("document.body.innerText");
  comprobar(html1.includes("Titular Uno"), "el primer titular ve su perfil");

  const entrada2 = await entrar(telefono2, cuenta2.contrasena);
  comprobar(entrada2.dentro, "el segundo titular entra con su teléfono");
  const html2 = await evaluar("document.body.innerText");
  comprobar(html2.includes("Titular Dos"), "el segundo titular ve su perfil");

  // 3. Convertir un segundo titular antiguo (sin cuenta) en usuario.
  const { data: segundoPerfil } = await admin
    .from("perfiles")
    .select("id")
    .eq("telefono", telefono2)
    .maybeSingle();
  segundoId = segundoPerfil?.id ?? null;

  await admin.from("miembros").delete().eq("usuario_id", segundoId);
  await admin
    .from("titulares")
    .update({ usuario_id: null, nombre: "Titular Dos" })
    .eq("finca_id", fincaId)
    .eq("usuario_id", segundoId);
  await admin.auth.admin.deleteUser(segundoId);

  const sesionAdmin2 = await entrar(correoAdmin, contrasenaAdmin);
  comprobar(sesionAdmin2.dentro, "el administrador vuelve a entrar");
  await ir("/plataforma");

  const editando = await evaluar(`(() => {
    const fila = [...document.querySelectorAll('tr')].find((tr) =>
      (tr.textContent ?? '').includes('Titular Uno'),
    );
    const boton = fila ? [...fila.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Editar'),
    ) : null;
    if (!boton) return false;
    boton.click();
    return true;
  })()`);
  comprobar(editando === true, "se abre la edición del vecino");
  await dormir(800);

  const datosCotitular = await evaluar(`(() => {
    const form = document.querySelector('form:has(input[name="cotitularTelefono"])');
    if (!form) return { error: 'sin-formulario' };
    const nombre = form.querySelector('input[name="cotitularNombre"]');
    const telefono = form.querySelector('input[name="cotitularTelefono"]');
    const inicial = { nombre: nombre?.value, telefono: telefono?.value };
    telefono.value = ${JSON.stringify(telefono2)};
    form.requestSubmit();
    return { inicial };
  })()`);
  comprobar(
    datosCotitular.inicial?.nombre === "Titular Dos",
    "el segundo titular antiguo aparece en la edición",
  );
  await dormir(5000);

  const credencialNueva = await leerCredenciales(
    "Cuenta creada para el segundo titular",
  );
  comprobar(credencialNueva.length === 1, "se crea la cuenta del segundo titular");
  comprobar(
    Boolean(credencialNueva[0]?.contrasena),
    "se muestran sus credenciales de acceso",
  );

  const { data: titularesFinal } = await admin
    .from("titulares")
    .select("usuario_id, porcentaje")
    .eq("finca_id", fincaId);
  comprobar(
    (titularesFinal ?? []).length === 2 &&
      (titularesFinal ?? []).every((titular) => Boolean(titular.usuario_id)),
    "los dos titulares tienen cuenta vinculada",
  );

  const entradaNueva = await entrar(telefono2, credencialNueva[0].contrasena);
  comprobar(entradaNueva.dentro, "el segundo titular antiguo ya puede entrar");

  ws.close();
  console.log("\nTodas las comprobaciones han pasado.");
}

try {
  await main();
} catch (error) {
  console.error("\nFALLO:", error.message);
  process.exitCode = 1;
} finally {
  if (comunidadId) {
    await admin.from("comunidades").delete().eq("id", comunidadId);
  }
  await borrarUsuariosDePrueba();
  for (const id of [adminId, segundoId]) {
    if (!id) continue;
    const { data } = await admin.from("perfiles").select("id").eq("id", id);
    if ((data ?? []).length > 0) {
      await admin.auth.admin.deleteUser(id).catch(() => {});
    }
  }
  if (chrome) {
    spawn("taskkill", ["/F", "/T", "/PID", String(chrome.pid)], { stdio: "ignore" });
  }
}
