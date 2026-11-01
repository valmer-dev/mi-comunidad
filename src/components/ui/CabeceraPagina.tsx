export function CabeceraPagina({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-suave">{descripcion}</p>}
      </div>
      {accion}
    </div>
  );
}

export function EstadoVacio({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
}) {
  return (
    <div className="tarjeta flex flex-col items-center py-12 text-center">
      <p className="text-base font-semibold">{titulo}</p>
      {descripcion && <p className="mt-1 max-w-sm text-sm text-suave">{descripcion}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}
