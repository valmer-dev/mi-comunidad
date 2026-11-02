-- ============================================================
-- Documentos: cinco categorias fijas y subida de PDF
-- ============================================================

-- ------------------------------------------------------------
-- 1. Categorias: Estatutos, Actas, Contratos, Certificados y Presupuestos
-- ------------------------------------------------------------
update public.documentos
   set carpeta = 'Estatutos'
 where carpeta not in (
   'Estatutos', 'Actas', 'Contratos', 'Certificados', 'Presupuestos'
 );

alter table public.documentos
  alter column carpeta set default 'Estatutos';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'documentos_carpeta_valida'
  ) then
    alter table public.documentos
      add constraint documentos_carpeta_valida
      check (
        carpeta in ('Estatutos', 'Actas', 'Contratos', 'Certificados', 'Presupuestos')
      );
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 2. Quien puede gestionar documentos:
--    administrador de plataforma, presidente, vicepresidente o vocal
-- ------------------------------------------------------------
create or replace function public.puede_gestionar_documentos(p_comunidad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.perfiles p
      where p.id = auth.uid()
        and p.es_admin_plataforma
    )
    or public.tiene_rol(
      p_comunidad_id,
      array['presidente', 'vicepresidente', 'vocal']::public.rol_miembro[]
    );
$$;

revoke all on function public.puede_gestionar_documentos(uuid) from public;
grant execute on function public.puede_gestionar_documentos(uuid) to authenticated;

drop policy if exists "documentos_escritura" on public.documentos;
create policy "documentos_escritura" on public.documentos
  for all to authenticated
  using (public.puede_gestionar_documentos(comunidad_id))
  with check (public.puede_gestionar_documentos(comunidad_id));

-- ------------------------------------------------------------
-- 3. Almacenamiento privado de PDF (maximo 25 MB)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Los miembros de la comunidad pueden leer los PDF de su comunidad.
drop policy if exists "documentos_storage_lectura" on storage.objects;
create policy "documentos_storage_lectura" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documentos'
    and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    and public.es_miembro(split_part(name, '/', 1)::uuid)
  );

-- Solo los roles autorizados pueden subir, reemplazar o borrar PDF.
drop policy if exists "documentos_storage_escritura" on storage.objects;
create policy "documentos_storage_escritura" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'documentos'
    and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    and public.puede_gestionar_documentos(split_part(name, '/', 1)::uuid)
  )
  with check (
    bucket_id = 'documentos'
    and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    and public.puede_gestionar_documentos(split_part(name, '/', 1)::uuid)
  );
