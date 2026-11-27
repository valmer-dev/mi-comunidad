export type Servicio = {
  id: string;
  nombre: string;
  categoria: string | null;
  telefono: string | null;
  cif: string | null;
  persona_contacto: string | null;
  correo: string | null;
  contrato_inicio: string | null;
  contrato_fin: string | null;
  renovacion_automatica: boolean;
  preaviso_dias: number | null;
  importe_anual: number | null;
  seguro_hasta: string | null;
  contrato_documento_id: string | null;
  notas: string | null;
};

export type DocumentoContrato = { id: string; nombre: string };

/** Campos del formulario de alta y de edicion de un servicio. */
export function CamposServicio({
  servicio,
  documentos,
}: {
  servicio?: Servicio;
  documentos: DocumentoContrato[];
}) {
  const p = servicio ? `-${servicio.id}` : "";
  return (
    <>
      <div className="sm:col-span-2">
        <label htmlFor={`servicio${p}`} className="etiqueta">
          Servicio
        </label>
        <input
          id={`servicio${p}`}
          name="servicio"
          required
          defaultValue={servicio?.categoria ?? ""}
          className="campo"
          placeholder="Mantenimiento de los ascensores"
        />
      </div>

      <div>
        <label htmlFor={`empresa${p}`} className="etiqueta">
          Empresa
        </label>
        <input
          id={`empresa${p}`}
          name="empresa"
          required
          defaultValue={servicio?.nombre ?? ""}
          className="campo"
          placeholder="Ascensores García, S.L."
        />
      </div>

      <div>
        <label htmlFor={`cif${p}`} className="etiqueta">
          CIF (opcional)
        </label>
        <input id={`cif${p}`} name="cif" defaultValue={servicio?.cif ?? ""} className="campo" placeholder="B12345678" />
      </div>

      <div>
        <label htmlFor={`telefono${p}`} className="etiqueta">
          Teléfono de contacto
        </label>
        <input
          id={`telefono${p}`}
          name="telefono"
          type="tel"
          required
          defaultValue={servicio?.telefono ?? ""}
          className="campo"
          placeholder="912 345 678"
        />
      </div>

      <div>
        <label htmlFor={`correo${p}`} className="etiqueta">
          Correo (opcional)
        </label>
        <input id={`correo${p}`} name="correo" type="email" defaultValue={servicio?.correo ?? ""} className="campo" />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor={`personaContacto${p}`} className="etiqueta">
          Persona de contacto (opcional)
        </label>
        <input
          id={`personaContacto${p}`}
          name="personaContacto"
          defaultValue={servicio?.persona_contacto ?? ""}
          className="campo"
        />
      </div>

      <fieldset className="grid gap-4 rounded-xl border border-borde p-3 sm:col-span-2 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Contrato</legend>
        <div>
          <label htmlFor={`contratoInicio${p}`} className="etiqueta">
            Desde
          </label>
          <input
            id={`contratoInicio${p}`}
            name="contratoInicio"
            type="date"
            defaultValue={servicio?.contrato_inicio ?? ""}
            className="campo"
          />
        </div>
        <div>
          <label htmlFor={`contratoFin${p}`} className="etiqueta">
            Hasta
          </label>
          <input
            id={`contratoFin${p}`}
            name="contratoFin"
            type="date"
            defaultValue={servicio?.contrato_fin ?? ""}
            className="campo"
          />
        </div>
        <div>
          <label htmlFor={`importeAnual${p}`} className="etiqueta">
            Importe anual (€)
          </label>
          <input
            id={`importeAnual${p}`}
            name="importeAnual"
            inputMode="decimal"
            defaultValue={servicio?.importe_anual != null ? String(servicio.importe_anual).replace(".", ",") : ""}
            className="campo"
            placeholder="1800,00"
          />
        </div>
        <div>
          <label htmlFor={`preavisoDias${p}`} className="etiqueta">
            Preaviso para darlo de baja (días)
          </label>
          <input
            id={`preavisoDias${p}`}
            name="preavisoDias"
            type="number"
            min={0}
            max={365}
            defaultValue={servicio?.preaviso_dias ?? ""}
            className="campo"
            placeholder="30"
          />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="renovacionAutomatica"
            defaultChecked={servicio?.renovacion_automatica ?? false}
            className="size-4"
          />
          Se renueva solo si no se avisa antes
        </label>
        <div className="sm:col-span-2">
          <label htmlFor={`contratoDocumentoId${p}`} className="etiqueta">
            PDF del contrato
          </label>
          <select
            id={`contratoDocumentoId${p}`}
            name="contratoDocumentoId"
            defaultValue={servicio?.contrato_documento_id ?? ""}
            className="campo"
          >
            <option value="">Sin PDF</option>
            {documentos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-suave">Sube antes el PDF en Documentos, carpeta Contratos.</p>
        </div>
      </fieldset>

      <div>
        <label htmlFor={`seguroHasta${p}`} className="etiqueta">
          Su seguro de responsabilidad civil vence el
        </label>
        <input
          id={`seguroHasta${p}`}
          name="seguroHasta"
          type="date"
          defaultValue={servicio?.seguro_hasta ?? ""}
          className="campo"
        />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor={`notas${p}`} className="etiqueta">
          Notas (opcional)
        </label>
        <textarea id={`notas${p}`} name="notas" rows={2} defaultValue={servicio?.notas ?? ""} className="campo" />
      </div>
    </>
  );
}
