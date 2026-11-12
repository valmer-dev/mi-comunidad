/**
 * Version del despliegue actual. El cliente compara este valor con el que
 * lleva incrustado su build (NEXT_PUBLIC_VERSION) para saber si hay una
 * version nueva sin tener que fiarse de la cache del service worker.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { version: process.env.NEXT_PUBLIC_VERSION ?? "local" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
