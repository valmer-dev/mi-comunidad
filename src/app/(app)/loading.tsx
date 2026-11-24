/**
 * Esqueleto que se muestra al instante al cambiar de modulo, mientras el
 * servidor prepara el contenido. Evita la sensacion de "clic y nada pasa".
 */
export default function Cargando() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>

      <div className="flex items-center gap-3.5">
        <div className="size-11 animate-pulse rounded-xl bg-borde sm:size-12" />
        <div className="space-y-2">
          <div className="h-7 w-44 animate-pulse rounded-lg bg-borde" />
          <div className="h-3 w-56 animate-pulse rounded-full bg-borde" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, indice) => (
          <div key={indice} className="tarjeta p-4">
            <div className="size-10 animate-pulse rounded-xl bg-borde" />
            <div className="mt-3 h-5 w-20 animate-pulse rounded bg-borde" />
            <div className="mt-2 h-3 w-24 animate-pulse rounded-full bg-borde" />
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="tarjeta space-y-3 lg:col-span-2">
          <div className="h-4 w-36 animate-pulse rounded bg-borde" />
          {Array.from({ length: 4 }).map((_, indice) => (
            <div key={indice} className="space-y-2 border-t border-borde pt-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-borde" />
              <div className="h-3 w-full animate-pulse rounded-full bg-borde" />
            </div>
          ))}
        </div>
        <div className="tarjeta space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-borde" />
          <div className="h-3 w-full animate-pulse rounded-full bg-borde" />
          <div className="h-3 w-4/5 animate-pulse rounded-full bg-borde" />
          <div className="h-8 w-28 animate-pulse rounded-lg bg-borde" />
        </div>
      </div>
    </div>
  );
}
