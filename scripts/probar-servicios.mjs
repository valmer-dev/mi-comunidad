// Comprueba el modulo de servicios: el presidente crea y edita, el
// vicepresidente ve los controles, el vecino solo consulta (y RLS le impide
// escribir) y el administrador de plataforma puede eliminar. Crea datos
// temporales y los borra al terminar.
//
// Uso: node --env-file=.env.local scripts/probar-servicios.mjs [url]
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const base = process.argv[2] ?? "http://localhost:3000";
const marca = Date.now();

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
const contrasena = `Servicio-${Math.random().toString(36).slice(2)}-A1`;
let comunidadId = null;
const usuarios = [];
let chrome = null;

function comprobar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
  console.log(`  ok  ${mensaje}`);
}

async function crearUsuario(rol, nombre, identificador, adminPlataforma = false) {
  const correo = `servicio-${identificador}-${marca}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email: correo,
    password: contrasena,
    email_confirm: true,
    user_metadata: { nombre },
  });
  if (error || !data.user) throw new Error(error?.message);

  usuarios.push(data.user.id);

  const { error: errorMiembro } = await admin.from("miembros").insert({
    comunidad_id: comunidadId,
    usuario_id: data.user.id,
    rol,
    estado: "activo",
  });
  if (errorMiembro) throw new Error(errorMiembro.message);

  if (adminPlataforma) {
    const { error: errorPerfil } = await admin
      .from("perfiles")
      .update({ es_admin_plataforma: true })
      .eq("id", data.user.id);
    if (errorPerfil) throw new Error(errorPerfil.message);
  }

  return { correo, nombre };
}

async function main() {
  console.log(`Prueba de servicios ${marca}`);

  const { data: comunidad, error: eComunidad } = await admin
    .from("comunidades")
    .insert({
      nombre: `Comunidad Servicios ${marca}`,
      numero_casas: 0,
      numero_pisos: 0,
    })
    .select("id")
    .single();
  if (eComunidad) throw new Error(`Comunidad: ${eComunidad.message}`);
  comunidadId = comunidad.id;

  const presidente = await crearUsuario("presidente", "Presidenta Prueba", "presidente");
  const vicepresidente = await crearUsuario(
    "vicepresidente",
    "Vicepresidente Prueba",
    "vicepresidente",
  );
  const vecino = await crearUsuario("vecino", "Vecino Prueba", "vecino");
  const plataforma = await crearUsuario(
    "vecino",
    "Admin Plataforma",
    "plataforma",
    true,
  );

  chrome = spawn(
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    [
      "--headless=new",
      "--remote-debugging-port=9337",
      `--user-data-dir=${process.env.TEMP}\\chrome-servicios-${marca}`,
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
      const res = await fetch("http://127.0.0.1:9337/json/new?about:blank", {
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
      throw new Error(
        resultado.exceptionDetails.exception?.description ?? "Error JS",
      );
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

  async function entrar(correo) {
    await enviar("Network.clearBrowserCookies");
    await ir("/entrar");
    await evaluar(`(() => {
      document.querySelector('input[name="identificador"]').value = ${JSON.stringify(correo)};
      document.querySelector('input[name="contrasena"]').value = ${JSON.stringify(contrasena)};
      document.querySelector('form').requestSubmit();
    })()`);
    await dormir(4500);
  }

  const buscarServicio = `(texto) => [...document.querySelectorAll('main li')].find((fila) =>
    (fila.textContent ?? '').includes(texto),
  )`;

  // 1. El presidente crea un servicio desde la interfaz.
  await entrar(presidente.correo);
  await ir("/servicios");

  const puedeCrear = await evaluar(`(() => {
    const boton = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Nuevo servicio'),
    );
    if (!boton) return false;
    boton.click();
    return true;
  })()`);
  comprobar(puedeCrear, "el presidente ve el botón Nuevo servicio");
  await dormir(800);

  await evaluar(`(() => {
    document.querySelector('input[name="servicio"]').value = 'Mantenimiento de los ascensores';
    document.querySelector('input[name="empresa"]').value = 'Ascensores Prueba, S.L.';
    document.querySelector('input[name="telefono"]').value = '912 345 678';
    document.querySelector('form:has(input[name="servicio"])').requestSubmit();
  })()`);
  await dormir(5000);

  const { data: creado, error: eCreado } = await admin
    .from("proveedores")
    .select("id, categoria, nombre, telefono")
    .eq("comunidad_id", comunidadId)
    .maybeSingle();
  if (eCreado) throw new Error(eCreado.message);
  comprobar(Boolean(creado), "el servicio se guarda");
  comprobar(
    creado.categoria === "Mantenimiento de los ascensores",
    "se guarda el servicio",
  );
  comprobar(creado.nombre === "Ascensores Prueba, S.L.", "se guarda la empresa");
  comprobar(creado.telefono === "912 345 678", "se guarda el teléfono");

  const pintado = await evaluar(`(() => {
    const item = (${buscarServicio})('Mantenimiento de los ascensores');
    if (!item) return { error: 'sin-servicio' };
    const enlace = item.querySelector('a[href^="tel:"]');
    return {
      empresa: (item.textContent ?? '').includes('Ascensores Prueba, S.L.'),
      telefono: enlace?.textContent?.trim() ?? '',
      href: enlace?.getAttribute('href') ?? '',
    };
  })()`);
  comprobar(pintado.empresa === true, "se muestra el nombre de la empresa");
  comprobar(
    pintado.telefono === "912 345 678" && pintado.href === "tel:912345678",
    "se muestra el teléfono como enlace para llamar",
  );

  // 2. El presidente edita el servicio.
  await evaluar(`(() => {
    const item = (${buscarServicio})('Mantenimiento de los ascensores');
    [...item.querySelectorAll('button')]
      .find((b) => (b.textContent ?? '').trim() === 'Editar')
      ?.click();
  })()`);
  await dormir(800);

  const edicionAbierta = await evaluar(
    `Boolean(document.querySelector('form:has(input[name="servicio"]):has(input[name="id"])'))`,
  );
  comprobar(edicionAbierta === true, "se abre el formulario de edición");

  await evaluar(`(() => {
    const form = document.querySelector('form:has(input[name="servicio"]):has(input[name="id"])');
    form.querySelector('input[name="empresa"]').value = 'Ascensores Prueba 24 h';
    form.querySelector('input[name="telefono"]').value = '600 111 222';
    form.requestSubmit();
  })()`);
  await dormir(5000);

  const { data: editado } = await admin
    .from("proveedores")
    .select("nombre, telefono")
    .eq("id", creado.id)
    .maybeSingle();
  comprobar(editado?.nombre === "Ascensores Prueba 24 h", "se edita la empresa");
  comprobar(editado?.telefono === "600 111 222", "se edita el teléfono");

  const trasEditar = await evaluar(`(() => {
    const item = (${buscarServicio})('Mantenimiento de los ascensores');
    return item ? (item.textContent ?? '') : '';
  })()`);
  comprobar(trasEditar.includes("Ascensores Prueba 24 h"), "la lista muestra los cambios");

  // 3. El vicepresidente también puede gestionar.
  await entrar(vicepresidente.correo);
  await ir("/servicios");
  const controlesVice = await evaluar(`(() => {
    const item = (${buscarServicio})('Mantenimiento de los ascensores');
    return {
      nuevo: [...document.querySelectorAll('button')].some((b) =>
        (b.textContent ?? '').includes('Nuevo servicio'),
      ),
      editar: [...(item?.querySelectorAll('button') ?? [])].some((b) =>
        (b.textContent ?? '').trim() === 'Editar',
      ),
      eliminar: [...(item?.querySelectorAll('button') ?? [])].some((b) =>
        (b.textContent ?? '').includes('Eliminar'),
      ),
    };
  })()`);
  comprobar(controlesVice.nuevo === true, "el vicepresidente ve Nuevo servicio");
  comprobar(controlesVice.editar === true, "el vicepresidente puede editar");
  comprobar(controlesVice.eliminar === true, "el vicepresidente puede eliminar");

  // 4. El vecino solo consulta, y RLS le impide escribir.
  await entrar(vecino.correo);
  await ir("/servicios");
  const controlesVecino = await evaluar(`(() => {
    const item = (${buscarServicio})('Mantenimiento de los ascensores');
    return {
      veServicio: Boolean(item),
      veTelefono: Boolean(item?.querySelector('a[href^="tel:"]')),
      nuevo: [...document.querySelectorAll('button')].some((b) =>
        (b.textContent ?? '').includes('Nuevo servicio'),
      ),
      acciones: [...(item?.querySelectorAll('button') ?? [])].length,
    };
  })()`);
  comprobar(controlesVecino.veServicio === true, "el vecino puede consultar el servicio");
  comprobar(controlesVecino.veTelefono === true, "el vecino ve el teléfono");
  comprobar(controlesVecino.nuevo === false, "el vecino no ve Nuevo servicio");
  comprobar(controlesVecino.acciones === 0, "el vecino no ve botones de edición ni borrado");

  const clienteVecino = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: eLoginVecino } = await clienteVecino.auth.signInWithPassword({
    email: vecino.correo,
    password: contrasena,
  });
  if (eLoginVecino) throw new Error(eLoginVecino.message);

  const { data: intentoVecino } = await clienteVecino
    .from("proveedores")
    .update({ nombre: "Cambiado por un vecino" })
    .eq("id", creado.id)
    .select("id");
  comprobar(
    !intentoVecino || intentoVecino.length === 0,
    "RLS impide que un vecino edite el servicio",
  );

  // 5. El administrador de plataforma (con rol vecino) puede eliminar.
  await entrar(plataforma.correo);
  await ir("/servicios");
  const controlesPlataforma = await evaluar(`(() => {
    const item = (${buscarServicio})('Mantenimiento de los ascensores');
    return [...(item?.querySelectorAll('button') ?? [])].some((b) =>
      (b.textContent ?? '').includes('Eliminar'),
    );
  })()`);
  comprobar(controlesPlataforma === true, "el administrador de plataforma puede eliminar");

  await evaluar(`(() => {
    window.confirm = () => true;
    const item = (${buscarServicio})('Mantenimiento de los ascensores');
    [...item.querySelectorAll('button')]
      .find((b) => (b.textContent ?? '').includes('Eliminar'))
      ?.click();
  })()`);
  await dormir(5000);

  const { data: restantes } = await admin
    .from("proveedores")
    .select("id")
    .eq("comunidad_id", comunidadId);
  comprobar((restantes ?? []).length === 0, "el servicio se elimina");

  const vacio = await evaluar(
    `(document.body.textContent ?? '').includes('Todavía no hay servicios registrados')`,
  );
  comprobar(vacio === true, "la página muestra el estado vacío");

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
  for (const id of usuarios) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  if (chrome) {
    spawn("taskkill", ["/F", "/T", "/PID", String(chrome.pid)], { stdio: "ignore" });
  }
}
