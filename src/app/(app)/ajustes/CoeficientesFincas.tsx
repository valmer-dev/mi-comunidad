"use client";

import { useActionState, useMemo, useState } from "react";
import { Loader2, Percent, Save, Scale } from "lucide-react";
import { guardarCoeficientes, type EstadoCoeficientes } from "@/app/acciones/comunidad";
import {
  aDiezmilesimas,
  deDiezmilesimas,
  formatoCoeficiente,
} from "@/lib/coeficientes";
import { cn } from "@/lib/utilidades";

const ESTADO_INICIAL: EstadoCoeficientes = {};

export type FincaCoeficiente = {
  id: string;
  codigo: string;
  tipo: string;
  coeficiente: number;
  titulares: string[];
};

const ETIQUETA_TIPO: Record<string, string> = {
  casa: "Casa",
  piso: "Piso",
  vivienda: "Vivienda",
  local: "Local",
  garaje: "Garaje",
  trastero: "Trastero",
  otro: "Otro",
};

/** Texto del campo: 12,5 en vez de 12.5000. */
function textoInicial(valor: number) {
  return formatoCoeficiente(valor).replace(/\./g, "");
}

export function CoeficientesFincas({
  fincas,
  coeficienteTotal,
}: {
  fincas: FincaCoeficiente[];
  coeficienteTotal: number;
}) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(fincas.map((finca) => [finca.id, textoInicial(finca.coeficiente)])),
  );
  const [estado, accion, pendiente] = useActionState(guardarCoeficientes, ESTADO_INICIAL);

  const total = aDiezmilesimas(String(coeficienteTotal)) ?? 100 * 10_000;

  const { suma, invalidos } = useMemo(() => {
    let acumulado = 0;
    const malos = new Set<string>();
    for (const finca of fincas) {
      const diezmilesimas = aDiezmilesimas(valores[finca.id]);
      if (diezmilesimas === null || diezmilesimas > 100 * 10_000) malos.add(finca.id);
      else acumulado += diezmilesimas;
    }
    return { suma: acumulado, invalidos: malos };
  }, [fincas, valores]);

  const diferencia = total - suma;
  const cuadra = invalidos.size === 0 && diferencia === 0;
  const sinCoeficiente = fincas.filter(
    (finca) => !invalidos.has(finca.id) && aDiezmilesimas(valores[finca.id]) === 0,
  ).length;

  function repartirIguales() {
    if (fincas.length === 0) return;
    const parte = Math.floor(total / fincas.length);
    const resto = total - parte * fincas.length;
    setValores(
      Object.fromEntries(
        fincas.map((finca, indice) => [
          finca.id,
          textoInicial(deDiezmilesimas(indice === fincas.length - 1 ? parte + resto : parte)),
        ]),
      ),
    );
  }

  return (
    <section className="tarjeta">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Percent className="size-4.5 text-principal" aria-hidden />
        Coeficientes de participación
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-suave">
        Es la cuota de cada finca que figura en la escritura de división horizontal.
        Con ella se reparten los gastos y se cuentan los votos y el quórum de las
        juntas. Entre todas deben sumar el {formatoCoeficiente(coeficienteTotal)} %.
      </p>

      {fincas.length === 0 ? (
        <p className="mt-4 rounded-xl bg-hundido px-3.5 py-2.5 text-sm text-suave">
          Todavía no hay fincas. Créalas primero en «Casas y pisos».
        </p>
      ) : (
        <form action={accion} className="mt-4">
          <ul className="grid gap-2 sm:grid-cols-2">
            {fincas.map((finca) => {
              const malo = invalidos.has(finca.id);
              return (
                <li
                  key={finca.id}
                  className="flex items-center gap-3 rounded-xl border border-borde px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`coef_${finca.id}`} className="block font-semibold leading-tight">
                      {finca.codigo}
                      <span className="ml-1.5 text-xs font-normal text-suave">
                        {ETIQUETA_TIPO[finca.tipo] ?? finca.tipo}
                      </span>
                    </label>
                    <p className="truncate text-xs text-suave">
                      {finca.titulares.length > 0 ? finca.titulares.join(", ") : "Sin titular"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      id={`coef_${finca.id}`}
                      name={`coef_${finca.id}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={valores[finca.id] ?? ""}
                      onChange={(evento) =>
                        setValores((anteriores) => ({
                          ...anteriores,
                          [finca.id]: evento.target.value,
                        }))
                      }
                      aria-invalid={malo || undefined}
                      className={cn(
                        "campo w-28 px-2 py-1.5 text-right tabular-nums",
                        malo && "border-peligro",
                      )}
                    />
                    <span className="text-sm text-suave" aria-hidden>
                      %
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div
            className={cn(
              "mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-sm",
              cuadra ? "bg-exito-claro text-exito" : "bg-atencion-claro text-atencion",
            )}
            aria-live="polite"
          >
            <span className="font-semibold tabular-nums">
              Suma: {formatoCoeficiente(deDiezmilesimas(suma))} % de{" "}
              {formatoCoeficiente(coeficienteTotal)} %
            </span>
            <span>
              {invalidos.size > 0
                ? `Revisa ${invalidos.size === 1 ? "1 valor" : `${invalidos.size} valores`}: número entre 0 y 100, con 4 decimales como mucho.`
                : diferencia === 0
                  ? "Cuadra."
                  : diferencia > 0
                    ? `Faltan ${formatoCoeficiente(deDiezmilesimas(diferencia))} %.`
                    : `Sobran ${formatoCoeficiente(deDiezmilesimas(-diferencia))} %.`}
            </span>
          </div>

          {sinCoeficiente > 0 && (
            <p className="aviso aviso-atencion mt-3">
              {sinCoeficiente === 1
                ? "Hay 1 finca con coeficiente 0: no pagará gastos ni contará en las votaciones."
                : `Hay ${sinCoeficiente} fincas con coeficiente 0: no pagarán gastos ni contarán en las votaciones.`}
            </p>
          )}

          {"error" in estado && estado.error && (
            <p className="aviso aviso-error mt-3">{estado.error}</p>
          )}
          {"ok" in estado && estado.ok && (
            <p className="aviso aviso-exito mt-3">{estado.mensaje}</p>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={repartirIguales} className="boton boton-borde">
              <Scale className="size-4" aria-hidden />
              Repartir a partes iguales
            </button>
            <button
              type="submit"
              disabled={pendiente || !cuadra}
              className="boton boton-principal"
            >
              {pendiente ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Save className="size-4" aria-hidden />
              )}
              {pendiente ? "Guardando…" : "Guardar coeficientes"}
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-suave">
            Las juntas ya celebradas conservan los coeficientes de su día. Las que
            todavía no se han celebrado pasan a usar los nuevos.
          </p>
        </form>
      )}
    </section>
  );
}
