import { formatoMoneda } from "@/lib/utilidades";

const FORMATO_MES = new Intl.DateTimeFormat("es-ES", { month: "short" });
const FORMATO_IMPORTE = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function ResumenMensual({
  anio,
  totales,
}: {
  anio: number;
  totales: number[];
}) {
  const maximo = Math.max(...totales, 0);
  const etiquetas = Array.from({ length: 12 }, (_, indice) =>
    FORMATO_MES.format(new Date(anio, indice, 1)).replace(".", ""),
  );

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-[560px] items-end gap-1.5 sm:gap-2">
        {totales.map((total, indice) => {
          const porcentaje = maximo > 0 ? (total / maximo) * 100 : 0;
          const etiqueta = etiquetas[indice] ?? "";

          return (
            <div key={indice} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="hidden h-4 text-[10px] font-medium tabular-nums text-suave sm:block">
                {total > 0 ? FORMATO_IMPORTE.format(total) : ""}
              </span>
              <div
                className="flex h-40 w-full items-end rounded-lg bg-fondo"
                role="img"
                aria-label={`${etiqueta}: ${formatoMoneda(total)}`}
                title={`${etiqueta}: ${formatoMoneda(total)}`}
              >
                <div
                  className="w-full rounded-lg bg-principal"
                  style={{ height: total > 0 ? `${Math.max(porcentaje, 4)}%` : 0 }}
                />
              </div>
              <span className="text-[11px] capitalize text-suave">{etiqueta}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
