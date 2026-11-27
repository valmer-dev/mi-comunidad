-- Proveedores y contratos (punto 11 del informe de administrador de fincas).
--
-- La tabla proveedores ya tenia CIF, contacto y fechas de contrato, pero la
-- app solo usaba nombre, servicio y telefono. Se anaden el PDF del contrato,
-- el importe anual, la renovacion y el preaviso, y la factura de cada gasto.

alter table public.proveedores
  add column if not exists contrato_documento_id uuid references public.documentos (id) on delete set null,
  add column if not exists importe_anual numeric(12,2) check (importe_anual is null or importe_anual >= 0),
  add column if not exists renovacion_automatica boolean not null default false,
  add column if not exists preaviso_dias integer check (preaviso_dias is null or preaviso_dias between 0 and 365);

alter table public.gastos
  add column if not exists factura_documento_id uuid references public.documentos (id) on delete set null;

create index if not exists idx_gastos_proveedor on public.gastos (proveedor_id, fecha desc) where proveedor_id is not null;
create index if not exists idx_proveedores_contrato_fin on public.proveedores (comunidad_id, contrato_fin) where contrato_fin is not null;

-- La app deja gestionar los servicios a quien administra la comunidad
-- (presidente y vicepresidente), y la politica solo admitia a quien edita
-- finanzas: el vicepresidente no podia guardar cambios.
drop policy if exists "proveedores_escritura" on public.proveedores;
create policy "proveedores_escritura" on public.proveedores
  for all to authenticated
  using (public.es_administrador(comunidad_id) or public.puede_editar_finanzas(comunidad_id))
  with check (public.es_administrador(comunidad_id) or public.puede_editar_finanzas(comunidad_id));

-- El proveedor y la factura de un gasto deben ser de la misma comunidad.
create or replace function public.validar_gasto_proveedor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.proveedor_id is not null and not exists (
    select 1 from public.proveedores where id = new.proveedor_id and comunidad_id = new.comunidad_id
  ) then
    raise exception 'El proveedor no es de esta comunidad' using errcode = '22023';
  end if;
  if new.factura_documento_id is not null and not exists (
    select 1 from public.documentos where id = new.factura_documento_id and comunidad_id = new.comunidad_id
  ) then
    raise exception 'La factura no es de esta comunidad' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_validar_gasto_proveedor on public.gastos;
create trigger tr_validar_gasto_proveedor
  before insert or update of proveedor_id, factura_documento_id on public.gastos
  for each row execute function public.validar_gasto_proveedor();

create or replace function public.validar_contrato_proveedor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.contrato_documento_id is not null and not exists (
    select 1 from public.documentos where id = new.contrato_documento_id and comunidad_id = new.comunidad_id
  ) then
    raise exception 'El contrato no es de esta comunidad' using errcode = '22023';
  end if;
  if new.contrato_inicio is not null and new.contrato_fin is not null and new.contrato_fin < new.contrato_inicio then
    raise exception 'El contrato no puede terminar antes de empezar' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_validar_contrato_proveedor on public.proveedores;
create trigger tr_validar_contrato_proveedor
  before insert or update on public.proveedores
  for each row execute function public.validar_contrato_proveedor();

-- Nueva carpeta de documentos para las facturas de los gastos.
alter table public.documentos drop constraint if exists documentos_carpeta_valida;
alter table public.documentos
  add constraint documentos_carpeta_valida
  check (carpeta in ('Estatutos', 'Actas', 'Contratos', 'Certificados', 'Presupuestos', 'Facturas'));
