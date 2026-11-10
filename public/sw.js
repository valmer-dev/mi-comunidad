// Service worker de la PWA: pantalla offline y cache de estaticos.
// No cachea HTML autenticado ni respuestas RSC para no mostrar datos viejos.
// Al cambiar el contenido de este archivo, sube VERSION para limpiar la cache.

const VERSION = "v1";
const CACHE = `comunidad-${VERSION}`;
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(
          claves
            .filter(
              (clave) => clave.startsWith("comunidad-") && clave !== CACHE,
            )
            .map((clave) => caches.delete(clave)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function esEstatico(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/iconos/")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegaciones: red primero; si falla, pantalla de sin conexion.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE);
        const offline = await cache.match(OFFLINE);

        return (
          offline ||
          new Response("Sin conexión", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }),
    );
    return;
  }

  // Estaticos con hash: cache primero y se rellena en la primera visita.
  if (!esEstatico(url)) return;

  event.respondWith(
    caches.match(request).then((cacheado) => {
      if (cacheado) return cacheado;

      return fetch(request).then((respuesta) => {
        if (respuesta.ok && respuesta.type === "basic") {
          const copia = respuesta.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copia));
        }

        return respuesta;
      });
    }),
  );
});
