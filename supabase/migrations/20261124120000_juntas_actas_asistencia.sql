-- ============================================================
-- Juntas: orden del dia, asistencia por vivienda y acta en PDF
-- ============================================================

-- ------------------------------------------------------------
-- 1. Orden del dia: recuento de votos por punto (suma de coeficientes)
-- ------------------------------------------------------------
alter table public.puntos_del_dia
  add column if not exists votos_favor numeric(8,4),
  add column if not exists votos_contra numeric(8,4),
  add column if not exists abstenciones numeric(8,4);

create index if not exists idx_puntos_junta
  on public.puntos_del_dia (junta_id, posicion);

-- ------------------------------------------------------------
-- 2. Asistencia por vivienda
--    La app nunca ha escrito en esta tabla. Si tuviera filas, la columna
--    obligatoria finca_id haria fallar la migracion entera sin cambiar nada.
-- ------------------------------------------------------------
alter table public.asistencias
  add column finca_id uuid not null references public.fincas (id) on delete cascade,
  add column representante_nombre text,
  add column registrado_por uuid references public.perfiles (id) on delete set null,
  alter column usuario_id drop not null,
  drop constraint if exists asistencias_junta_id_usuario_id_key,
  add constraint asistencias_junta_finca_key unique (junta_id, finca_id);

-- Copia el coeficiente de la vivienda y comprueba que es de la misma comunidad.
create or replace function public.preparar_asistencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_coeficiente numeric(8,4);
begin
  select f.coeficiente
    into v_coeficiente
    from public.fincas f
    join public.juntas j on j.comunidad_id = f.comunidad_id
   where f.id = new.finca_id
     and j.id = new.junta_id;

  if not found then
    raise exception 'La vivienda no pertenece a la comunidad de la junta';
  end if;

  new.coeficiente = v_coeficiente;
  return new;
end;
$$;

drop trigger if exists tr_asistencias_preparar on public.asistencias;
create trigger tr_asistencias_preparar
  before insert or update of finca_id, junta_id on public.asistencias
  for each row execute function public.preparar_asistencia();

-- ------------------------------------------------------------
-- 3. Acta en la junta
-- ------------------------------------------------------------
alter table public.juntas
  add column if not exists acta_texto text,
  add column if not exists acta_documento_id uuid references public.documentos (id) on delete set null,
  add column if not exists acta_aprobada_en date,
  add column if not exists celebrada_en timestamptz,
  drop column if exists acta_url;

-- ------------------------------------------------------------
-- 4. Storage: quien administra la comunidad (presidente, vicepresidente,
--    secretario...) puede subir actas en <comunidad>/actas/ aunque no
--    gestione el resto de Documentos.
-- ------------------------------------------------------------
drop policy if exists "actas_storage_escritura" on storage.objects;
create policy "actas_storage_escritura" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'documentos'
    and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    and split_part(name, '/', 2) = 'actas'
    and public.es_administrador(split_part(name, '/', 1)::uuid)
  )
  with check (
    bucket_id = 'documentos'
    and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    and split_part(name, '/', 2) = 'actas'
    and public.es_administrador(split_part(name, '/', 1)::uuid)
  );
