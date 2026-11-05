// Comprueba el editor enriquecido del tablon: negrita y listas se guardan y se
// pintan, el texto plano antiguo sigue funcionando y el HTML peligroso se
// elimina. Crea datos temporales y los borra al terminar.
//
// Uso: node --env-file=.env.local scripts/probar-anuncio-rico.mjs [url]
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const base = process.argv[2] ?? "http://localhost:3000";
const marca = Date.now();
const correo = `admin-anuncios-${marca}@example.com`;
const contrasena = `Anuncio-${Math.random().toString(36).slice(2)}-A1`;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
let comunidadId = null;
let usuarioId = null;
let chrome = null;

function comprobar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
  console.log(`  ok  ${mensaje}`);
}

async function main() {
  console.log(`Prueba del editor de anuncios ${marca}`);

  const { data: comunidad, error: eComunidad } = await admin
    .from("comunidades")
    .insert({
      nombre: `Comunidad Anuncios ${marca}`,
      numero_casas: 0,
      numero_pisos: 0,
    })
    .select("id")
    .single();
  if (eComunidad) throw new Error(`Comunidad: ${eComunidad.message}`);
  comunidadId = comunidad.id;

  const { data: usuario, error: eUsuario } = await admin.auth.admin.createUser({
    email: correo,
    password: contrasena,
    email_confirm: true,
    user_metadata: { nombre: "Presidenta Prueba" },
  });
  if (eUsuario || !usuario.user) throw new Error(eUsuario?.message);
  usuarioId = usuario.user.id;

  const { error: eMiembro } = await admin.from("miembros").insert({
    comunidad_id: comunidadId,
    usuario_id: usuarioId,
    rol: "presidente",
    estado: "activo",
  });
  if (eMiembro) throw new Error(eMiembro.message);

  chrome = spawn(
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    [
      "--headless=new",
      "--remote-debugging-port=9335",
      `--user-data-dir=${process.env.TEMP}\\chrome-anuncios-${marca}`,
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
      const res = await fetch("http://127.0.0.1:9335/json/new?about:blank", {
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

  // Inicio de sesion.
  await ir("/entrar");
  await evaluar(`(() => {
    document.querySelector('input[name="identificador"]').value = ${JSON.stringify(correo)};
    document.querySelector('input[name="contrasena"]').value = ${JSON.stringify(contrasena)};
    document.querySelector('form').requestSubmit();
  })()`);
  await dormir(4500);

  // 1. Publicar con el editor: negrita y lista.
  await ir("/tablon");
  const abierto = await evaluar(`(() => {
    const boton = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Publicar anuncio'),
    );
    if (!boton) return false;
    boton.click();
    return true;
  })()`);
  comprobar(abierto === true, "se abre el formulario del anuncio");
  await dormir(800);

  const editorPreparado = await evaluar(`(() => {
    const editor = document.querySelector('[role="textbox"][aria-label="Contenido del anuncio"]');
    if (!editor) return 'sin-editor';
    document.querySelector('input[name="titulo"]').value = 'Aviso con formato';

    editor.focus();
    editor.innerHTML = 'Aviso importante para la comunidad';
    editor.dispatchEvent(new InputEvent('input', { bubbles: true }));

    // Selecciona todo y aplica negrita desde la barra de herramientas.
    const rango = document.createRange();
    rango.selectNodeContents(editor);
    const seleccion = window.getSelection();
    seleccion.removeAllRanges();
    seleccion.addRange(rango);

    const negrita = document.querySelector('button[aria-label="Negrita"]');
    if (!negrita) return 'sin-negrita';
    negrita.click();

    // Al final, un parrafo nuevo y una lista con dos puntos.
    const final = document.createRange();
    final.selectNodeContents(editor);
    final.collapse(false);
    seleccion.removeAllRanges();
    seleccion.addRange(final);
    document.execCommand('insertParagraph');
    document.execCommand('insertText', false, 'Primer punto');
    document.querySelector('button[aria-label="Lista con viñetas"]').click();
    document.execCommand('insertParagraph');
    document.execCommand('insertText', false, 'Segundo punto');

    const oculto = document.querySelector('input[name="contenido"]');
    return {
      html: oculto?.value ?? '',
      negrita: Boolean(editor.querySelector('b, strong')),
      elementosLista: editor.querySelectorAll('li').length,
    };
  })()`);
  comprobar(editorPreparado.negrita === true, "el botón de negrita aplica formato");
  comprobar(editorPreparado.elementosLista === 2, "la lista crea dos elementos");
  comprobar(
    editorPreparado.html.includes("<b") || editorPreparado.html.includes("<strong"),
    "el campo oculto guarda el HTML con negrita",
  );

  await evaluar(
    "document.querySelector('form:has(input[name=\"contenido\"])').requestSubmit()",
  );
  await dormir(5000);

  const { data: creado } = await admin
    .from("anuncios")
    .select("id, contenido")
    .eq("comunidad_id", comunidadId)
    .maybeSingle();
  comprobar(Boolean(creado), "el anuncio se guarda");
  comprobar(
    /<(b|strong)[\s>]/i.test(creado.contenido),
    "se conserva la negrita",
  );
  comprobar(
    (creado.contenido.match(/<li[\s>]/gi) ?? []).length === 2,
    "se conservan los dos elementos de la lista",
  );

  await ir("/tablon");
  const pintado = await evaluar(`(() => {
    const articulo = [...document.querySelectorAll('li')].find((fila) =>
      (fila.textContent ?? '').includes('Aviso con formato'),
    );
    if (!articulo) return { error: 'sin-anuncio' };
    return {
      negrita: Boolean(articulo.querySelector('b, strong')),
      elementos: articulo.querySelectorAll('ul li').length,
      texto: articulo.textContent,
    };
  })()`);
  comprobar(pintado.negrita === true, "el tablón pinta la negrita");
  comprobar(pintado.elementos === 2, "el tablón pinta la lista");
  comprobar(
    pintado.texto.includes("Primer punto") && pintado.texto.includes("Segundo punto"),
    "el texto de los puntos se ve",
  );

  // 1b. Un anuncio sin texto (solo etiquetas) se rechaza.
  await ir("/tablon");
  await evaluar(`(() => {
    const boton = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Publicar anuncio'),
    );
    boton?.click();
  })()`);
  await dormir(800);
  await evaluar(`(() => {
    const editor = document.querySelector('[role="textbox"][aria-label="Contenido del anuncio"]');
    document.querySelector('input[name="titulo"]').value = 'Anuncio vacío';
    editor.innerHTML = '<p><br></p>';
    editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
    document.querySelector('form:has(input[name="contenido"])').requestSubmit();
  })()`);
  await dormir(4000);
  const errorVacio = await evaluar(
    "document.querySelector('.bg-red-50')?.textContent ?? ''",
  );
  comprobar(
    errorVacio.includes("Escribe el contenido"),
    "rechaza un anuncio sin texto",
  );
  const { count: totalAnuncios } = await admin
    .from("anuncios")
    .select("*", { count: "exact", head: true })
    .eq("comunidad_id", comunidadId);
  comprobar(totalAnuncios === 1, "no se guarda el anuncio vacío");

  // 2. HTML peligroso y texto plano antiguo insertados directamente.
  const { error: eSucio } = await admin.from("anuncios").insert([
    {
      comunidad_id: comunidadId,
      titulo: "Anuncio con HTML peligroso",
      contenido:
        '<p onclick="alert(1)">Hola <strong>fuerte</strong></p>' +
        "<ul><li>Uno</li><li>Dos</li></ul>" +
        '<script>alert("xss")</script>' +
        '<img src="x" onerror="alert(2)">' +
        '<a href="javascript:alert(3)">enlace malo</a>',
    },
    {
      comunidad_id: comunidadId,
      titulo: "Anuncio antiguo",
      contenido: "Primera linea\nSegunda linea",
    },
  ]);
  if (eSucio) throw new Error(eSucio.message);

  await ir("/tablon");
  const seguridad = await evaluar(`(() => {
    const articulo = [...document.querySelectorAll('li')].find((fila) =>
      (fila.textContent ?? '').includes('Anuncio con HTML peligroso'),
    );
    if (!articulo) return { error: 'sin-anuncio' };
    return {
      html: articulo.innerHTML,
      lista: articulo.querySelectorAll('ul li').length,
      negrita: Boolean(articulo.querySelector('strong')),
      texto: articulo.textContent,
    };
  })()`);
  comprobar(seguridad.lista === 2, "el HTML permitido se conserva");
  comprobar(seguridad.negrita === true, "la negrita permitida se conserva");
  comprobar(
    !/<script|onerror|onclick|javascript:/i.test(seguridad.html),
    "el HTML peligroso se elimina",
  );
  comprobar(
    seguridad.texto.includes("enlace malo"),
    "el texto del enlace peligroso se conserva sin el enlace",
  );

  const antiguo = await evaluar(`(() => {
    const articulo = [...document.querySelectorAll('li')].find((fila) =>
      (fila.textContent ?? '').includes('Anuncio antiguo'),
    );
    return articulo ? articulo.innerHTML : '';
  })()`);
  comprobar(
    /Primera linea<br>Segunda linea/.test(antiguo),
    "el texto plano antiguo conserva los saltos de línea",
  );

  // 3. El panel muestra un extracto sin etiquetas.
  await ir("/panel");
  const extracto = await evaluar(`(() => {
    const elemento = [...document.querySelectorAll('p')].find((p) =>
      (p.textContent ?? '').includes('Aviso importante para la comunidad'),
    );
    return elemento ? elemento.textContent : '';
  })()`);
  comprobar(
    extracto.includes("Aviso importante") && !extracto.includes("<"),
    "el panel muestra el extracto como texto",
  );

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
  if (usuarioId) {
    await admin.auth.admin.deleteUser(usuarioId).catch(() => {});
  }
  if (chrome) {
    spawn("taskkill", ["/F", "/T", "/PID", String(chrome.pid)], { stdio: "ignore" });
  }
}
