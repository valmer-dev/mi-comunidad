// Prueba del menu movil con Chrome headless (CDP). Datos temporales.
import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
const base = process.argv[2] ?? "http://localhost:3100";
const puertoCdp = 9333;

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
const contrasena = "Menu-movil-7531";
const sello = String(Date.now()).slice(-8);
const correo = `prueba-menu-${sello}@example.invalid`;

let fallos = 0;
function marcar(texto, condicion) {
  console.log(`  ${condicion ? "ok" : "FALLO"}  ${texto}`);
  if (!condicion) fallos += 1;
}

const { data: comunidad } = await admin.from("comunidades").select("id").limit(1).single();
const { data: creado, error: errorUsuario } = await admin.auth.admin.createUser({
  email: correo,
  password: contrasena,
  email_confirm: true,
  user_metadata: { nombre: "Prueba Menu" },
});
if (errorUsuario) throw errorUsuario;
const usuarioId = creado.user.id;
await admin.from("miembros").insert({
  comunidad_id: comunidad.id,
  usuario_id: usuarioId,
  rol: "presidente",
  estado: "activo",
});

const cliente = createClient(url, anon, { auth: { persistSession: false } });
const { data: sesion, error: errorLogin } = await cliente.auth.signInWithPassword({
  email: correo,
  password: contrasena,
});
if (errorLogin) throw errorLogin;
const cookies = chunks(
  `sb-${new URL(url).hostname.split(".")[0]}-auth-token`,
  "base64-" + Buffer.from(JSON.stringify(sesion.session), "utf8").toString("base64url"),
);

const perfil = mkdtempSync(join(tmpdir(), "menu-movil-"));
const chrome = spawn(
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless=new",
    `--remote-debugging-port=${puertoCdp}`,
    `--user-data-dir=${perfil}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

async function depurar() {
  for (let intento = 0; intento < 40; intento += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${puertoCdp}/json/list`);
      const lista = await res.json();
      const pagina = lista.find((t) => t.type === "page");
      if (pagina) return pagina.webSocketDebuggerUrl;
    } catch {
      /* aun arrancando */
    }
    await esperar(250);
  }
  throw new Error("Chrome no arranco");
}

let ws;
let siguiente = 1;
const pendientes = new Map();

function enviar(metodo, params = {}) {
  const id = siguiente++;
  ws.send(JSON.stringify({ id, method: metodo, params }));
  return new Promise((resolver, rechazar) => {
    pendientes.set(id, { resolver, rechazar });
    setTimeout(() => {
      if (pendientes.has(id)) {
        pendientes.delete(id);
        rechazar(new Error(`Sin respuesta a ${metodo}`));
      }
    }, 20000);
  });
}

const NAV = 'nav[aria-label="Navegación móvil"]';

try {
  ws = new WebSocket(await depurar());
  await new Promise((resolver) => ws.addEventListener("open", resolver));
  ws.addEventListener("message", (evento) => {
    const datos = JSON.parse(evento.data);
    if (datos.id && pendientes.has(datos.id)) {
      const { resolver, rechazar } = pendientes.get(datos.id);
      pendientes.delete(datos.id);
      datos.error ? rechazar(new Error(datos.error.message)) : resolver(datos.result);
    }
  });

  await enviar("Page.enable");
  await enviar("Network.enable");
  await enviar("Runtime.enable");

  for (const cookie of cookies) {
    await enviar("Network.setCookie", {
      name: cookie.name,
      value: cookie.value,
      domain: new URL(base).hostname,
      path: "/",
      httpOnly: false,
    });
  }

  await enviar("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
  });

  await enviar("Page.navigate", { url: `${base}/documentos` });
  await esperar(4500);

  const evaluar = async (expresion) => {
    const resultado = await enviar("Runtime.evaluate", {
      expression: expresion,
      returnByValue: true,
      awaitPromise: true,
    });
    if (resultado.exceptionDetails) {
      throw new Error(
        resultado.exceptionDetails.exception?.description ??
          resultado.exceptionDetails.text ??
          "Error al evaluar",
      );
    }
    return resultado.result.value;
  };

  const inicial = await evaluar(`(() => {
    const nav = document.querySelector('${NAV}');
    if (!nav) return { nav: false, ruta: location.pathname, cuerpo: document.body.innerText.slice(0, 200) };
    const columnas = getComputedStyle(nav.querySelector("ul")).gridTemplateColumns;
    const botones = [...nav.querySelectorAll("button")].map((b) => b.textContent.trim());
    return {
      nav: true,
      visible: nav.getBoundingClientRect().top < window.innerHeight,
      columnas,
      botones,
      menuCerrado: !document.getElementById("menu-mas"),
      titulo: document.title,
      ruta: location.pathname,
    };
  })()`);

  console.log("1. Barra inferior en movil:");
  marcar("existe la barra de navegacion", inicial.nav === true);
  if (!inicial.nav) {
    console.log("   ruta:", inicial.ruta, "| cuerpo:", inicial.cuerpo);
  }
  marcar("la barra esta dentro de la pantalla", inicial.visible === true);
  marcar("tiene 5 columnas", String(inicial.columnas ?? "").split(" ").length === 5);
  marcar("existe el boton Mas", (inicial.botones ?? []).includes("Más"));
  marcar("el menu empieza cerrado", inicial.menuCerrado === true);
  marcar("se esta en Documentos", inicial.ruta === "/documentos");

  const abierto = await evaluar(`(async () => {
    const boton = [...document.querySelectorAll('${NAV} button')]
      .find((b) => b.textContent.trim() === "Más");
    if (!boton) return { error: "sin boton" };
    boton.click();
    await new Promise((r) => setTimeout(r, 400));
    const menu = document.getElementById("menu-mas");
    if (!menu) return { error: "no se abrio" };
    const marco = menu.getBoundingClientRect();
    return {
      enlaces: [...menu.querySelectorAll("a")].map((a) => ({
        texto: a.textContent.trim(),
        href: a.getAttribute("href"),
      })),
      visible: marco.top >= 0 && marco.bottom <= window.innerHeight && marco.width > 0,
      dentroPantalla: marco.left >= 0 && marco.right <= window.innerWidth,
      cerrarSesion: [...menu.querySelectorAll("button")].some((b) =>
        b.textContent.includes("Cerrar sesión"),
      ),
      expandido: boton.getAttribute("aria-expanded"),
      controles: boton.getAttribute("aria-controls"),
    };
  })()`);

  console.log("2. Menu Mas:");
  marcar("se abre al pulsar Mas", !abierto.error);
  marcar(
    "se ve dentro de la pantalla",
    abierto.visible === true && abierto.dentroPantalla === true,
  );
  const hrefs = (abierto.enlaces ?? []).map((e) => e.href);
  marcar("incluye Documentos", hrefs.includes("/documentos"));
  marcar("incluye Juntas", hrefs.includes("/juntas"));
  marcar("incluye Finanzas (presidenta)", hrefs.includes("/finanzas"));
  marcar("incluye Ajustes", hrefs.includes("/ajustes"));
  marcar("incluye Cerrar sesion", abierto.cerrarSesion === true);
  marcar(
    "aria-expanded correcto",
    abierto.expandido === "true" && abierto.controles === "menu-mas",
  );

  // Volver al panel y navegar a Documentos desde el menu.
  await enviar("Page.navigate", { url: `${base}/panel` });
  await esperar(3000);

  const navegacion = await evaluar(`(async () => {
    const boton = [...document.querySelectorAll('${NAV} button')]
      .find((b) => b.textContent.trim() === "Más");
    if (!boton) return { error: "sin boton en el panel" };
    boton.click();
    await new Promise((r) => setTimeout(r, 400));
    const a = [...document.querySelectorAll('#menu-mas a')].find(
      (x) => x.getAttribute("href") === "/documentos",
    );
    if (!a) return { error: "sin enlace a documentos" };
    a.click();
    await new Promise((r) => setTimeout(r, 2500));
    return {
      url: location.pathname,
      menuCerrado: !document.getElementById("menu-mas"),
      titulo: document.title,
      categorias: ["Estatutos", "Actas", "Contratos", "Certificados", "Presupuestos"].every(
        (c) => document.body.innerText.includes(c),
      ),
    };
  })()`);

  console.log("3. Navegacion real:");
  marcar("abre /documentos desde el menu", navegacion.url === "/documentos");
  marcar("el menu se cierra al navegar", navegacion.menuCerrado === true);
  marcar("se ven las cinco categorias", navegacion.categorias === true);
  marcar("el titulo es Documentos", String(navegacion.titulo).includes("Documentos"));

  // Vecino sin permisos de gestion: Documentos sigue accesible.
  await admin
    .from("miembros")
    .update({ rol: "vecino" })
    .eq("comunidad_id", comunidad.id)
    .eq("usuario_id", usuarioId);
  await enviar("Page.navigate", { url: `${base}/panel` });
  await esperar(3000);

  const vecino = await evaluar(`(async () => {
    const boton = [...document.querySelectorAll('${NAV} button')]
      .find((b) => b.textContent.trim() === "Más");
    boton.click();
    await new Promise((r) => setTimeout(r, 400));
    const menu = document.getElementById("menu-mas");
    return {
      hrefs: [...menu.querySelectorAll("a")].map((a) => a.getAttribute("href")),
      botonSubir: document.body.innerText.includes("Subir documento"),
    };
  })()`);

  console.log("4. Vecino normal:");
  marcar("sigue viendo Documentos", vecino.hrefs.includes("/documentos"));
  marcar("no ve Finanzas", !vecino.hrefs.includes("/finanzas"));
  marcar("no ve Plataforma", !vecino.hrefs.includes("/plataforma"));
} catch (error) {
  console.error("ERROR:", error.message);
  fallos += 1;
} finally {
  try {
    ws?.close();
  } catch {
    /* nada */
  }
  chrome.kill();
  await esperar(500);
  try {
    rmSync(perfil, { recursive: true, force: true });
  } catch {
    /* nada */
  }
  await admin.auth.admin.deleteUser(usuarioId);
  console.log("Datos de prueba eliminados (1 usuario)");
  process.exit(fallos > 0 ? 1 : 0);
}
