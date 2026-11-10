import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const RUTAS_PUBLICAS = ["/entrar", "/sin-acceso", "/offline.html"];

export async function proxy(peticion: NextRequest) {
  let respuesta = NextResponse.next({ request: peticion });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return peticion.cookies.getAll();
        },
        setAll(lista) {
          lista.forEach(({ name, value }) => peticion.cookies.set(name, value));
          respuesta = NextResponse.next({ request: peticion });
          lista.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims verifica el JWT en local (JWKS en cache) y refresca la sesion
  // solo cuando hace falta. getUser() obligaba a una llamada de red en cada
  // navegacion, lo que hacia lento el cambio entre modulos.
  const { data } = await supabase.auth.getClaims();
  const usuario = data?.claims ?? null;

  const ruta = peticion.nextUrl.pathname;
  const esPublica = RUTAS_PUBLICAS.some(
    (publica) => ruta === publica || ruta.startsWith(`${publica}/`),
  );

  if (!usuario && !esPublica) {
    const destino = peticion.nextUrl.clone();
    destino.pathname = "/entrar";
    if (ruta !== "/") destino.searchParams.set("destino", ruta);
    return NextResponse.redirect(destino);
  }

  if (usuario && ruta === "/entrar") {
    const destino = peticion.nextUrl.clone();
    destino.pathname = "/panel";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  return respuesta;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
