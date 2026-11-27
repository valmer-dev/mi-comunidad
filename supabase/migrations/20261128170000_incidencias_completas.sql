-- Incidencias completas (punto 12 del informe de administrador de fincas).
--
-- Fotos, proveedor que lo arregla y coste, si el arreglo corre a cargo de la
-- comunidad o del propietario de una vivienda (privativo), el gasto en que se
-- apunta y el parte al seguro de la comunidad.

alter table public.incidencias
  add column if not exists responsable text not null default 'comunidad'
    check (responsable in ('comunidad', 'privativo', 'por_determinar')),
  add column if not exists gasto_id uuid references public.gastos (id) on delete set null,
  add column if not exists seguro_parte text check (seguro_parte is null or length(seguro_parte) <= 60),
  add column if not exists seguro_comunicado_en date,
  add column if not exists seguro_estado text
    check (seguro_estado is null or seguro_estado in ('comunicado', 'peritado', 'indemnizado', 'rechazado')),
  add column if not exists seguro_indemnizacion numeric(12,2) check (seguro_indemnizacion is null or seguro_indemnizacion >= 0);

alter table public.incidencias drop constraint if exists incidencias_coste_positivo;
alter table public.incidencias
  add constraint incidencias_coste_positivo check (coste is null or coste >= 0);

-- Proveedor, vivienda y gasto deben ser de la misma comunidad.
create or replace function public.validar_incidencia()
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
  if new.finca_id is not null and not exists (
    select 1 from public.fincas where id = new.finca_id and comunidad_id = new.comunidad_id
  ) then
    raise exception 'La vivienda no es de esta comunidad' using errcode = '22023';
  end if;
  if new.gasto_id is not null and not exists (
    select 1 from public.gastos where id = new.gasto_id and comunidad_id = new.comunidad_id
  ) then
    raise exception 'El gasto no es de esta comunidad' using errcode = '22023';
  end if;
  if new.responsable = 'privativo' and new.finca_id is null then
    raise exception 'Indica la vivienda que paga el arreglo privativo' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_validar_incidencia on public.incidencias;
create trigger tr_validar_incidencia
  before insert or update of proveedor_id, finca_id, gasto_id, responsable on public.incidencias
  for each row execute function public.validar_incidencia();

-- ------------------------------------------------------------
-- Fotos
-- ------------------------------------------------------------
create table if not exists public.incidencias_fotos (
  id uuid primary key default gen_random_uuid(),
  incidencia_id uuid not null references public.incidencias (id) on delete cascade,
  ruta text not null unique,
  subido_por uuid references public.perfiles (id) on delete set null default auth.uid(),
  creado_en timestamptz not null default now()
);

create index if not exists idx_incidencias_fotos on public.incidencias_fotos (incidencia_id, creado_en);

alter table public.incidencias_fotos enable row level security;

-- Quien registro la incidencia o la junta pueden anadir fotos.
create or replace function public.puede_anadir_fotos(p_incidencia_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.incidencias i
     where i.id = p_incidencia_id
       and public.es_miembro(i.comunidad_id)
       and (i.reportado_por = auth.uid() or public.puede_gestionar_incidencias(i.comunidad_id))
  );
$$;

revoke all on function public.puede_anadir_fotos(uuid) from public, anon;
grant execute on function public.puede_anadir_fotos(uuid) to authenticated;

drop policy if exists "incidencias_fotos_lectura" on public.incidencias_fotos;
create policy "incidencias_fotos_lectura" on public.incidencias_fotos
  for select to authenticated
  using (exists (
    select 1 from public.incidencias i where i.id = incidencia_id and public.es_miembro(i.comunidad_id)
  ));

drop policy if exists "incidencias_fotos_alta" on public.incidencias_fotos;
create policy "incidencias_fotos_alta" on public.incidencias_fotos
  for insert to authenticated
  with check (
    subido_por = auth.uid()
    and public.puede_anadir_fotos(incidencia_id)
    and split_part(ruta, '/', 2) = incidencia_id::text
    and exists (
      select 1 from public.incidencias i
       where i.id = incidencia_id and split_part(ruta, '/', 1) = i.comunidad_id::text
    )
  );

drop policy if exists "incidencias_fotos_borrado" on public.incidencias_fotos;
create policy "incidencias_fotos_borrado" on public.incidencias_fotos
  for delete to authenticated
  using (
    subido_por = auth.uid()
    or exists (
      select 1 from public.incidencias i
       where i.id = incidencia_id and public.puede_gestionar_incidencias(i.comunidad_id)
    )
  );

grant select, insert, delete on public.incidencias_fotos to authenticated;

-- Como mucho 8 fotos por incidencia.
create or replace function public.limitar_fotos_incidencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select count(*) from public.incidencias_fotos where incidencia_id = new.incidencia_id) >= 8 then
    raise exception 'Una incidencia puede tener 8 fotos como mucho' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_limitar_fotos_incidencia on public.incidencias_fotos;
create trigger tr_limitar_fotos_incidencia
  before insert on public.incidencias_fotos
  for each row execute function public.limitar_fotos_incidencia();

-- Almacenamiento privado de las fotos: <comunidad>/<incidencia>/<uuid>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('incidencias', 'incidencias', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "incidencias_storage_lectura" on storage.objects;
create policy "incidencias_storage_lectura" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'incidencias'
    and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    and public.es_miembro(split_part(name, '/', 1)::uuid)
  );

drop policy if exists "incidencias_storage_alta" on storage.objects;
create policy "incidencias_storage_alta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'incidencias'
    and split_part(name, '/', 2) ~ '^[0-9a-fA-F-]{36}$'
    and public.puede_anadir_fotos(split_part(name, '/', 2)::uuid)
    and exists (
      select 1 from public.incidencias i
       where i.id = split_part(name, '/', 2)::uuid
         and i.comunidad_id::text = split_part(name, '/', 1)
    )
  );

drop policy if exists "incidencias_storage_borrado" on storage.objects;
create policy "incidencias_storage_borrado" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'incidencias'
    and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    and (owner = auth.uid() or public.puede_gestionar_incidencias(split_part(name, '/', 1)::uuid))
  );
