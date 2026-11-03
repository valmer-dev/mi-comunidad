-- ============================================================
-- Incidencias: solo la junta directiva cambia el estado
-- ============================================================
-- Presidente, vicepresidente y vocal pueden cambiar el estado y dejar un
-- comentario de seguimiento. El resto de vecinos solo consulta.

-- ------------------------------------------------------------
-- 1. Quien puede gestionar incidencias
-- ------------------------------------------------------------
create or replace function public.puede_gestionar_incidencias(p_comunidad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.tiene_rol(
    p_comunidad_id,
    array['presidente', 'vicepresidente', 'vocal']::public.rol_miembro[]
  );
$$;

revoke all on function public.puede_gestionar_incidencias(uuid) from public;
grant execute on function public.puede_gestionar_incidencias(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2. Solo la junta directiva puede modificar una incidencia
--    (antes tambien podia quien la habia registrado)
-- ------------------------------------------------------------
drop policy if exists "incidencias_edicion" on public.incidencias;
create policy "incidencias_edicion" on public.incidencias
  for update to authenticated
  using (public.puede_gestionar_incidencias(comunidad_id))
  with check (public.puede_gestionar_incidencias(comunidad_id));

-- ------------------------------------------------------------
-- 3. Los comentarios de seguimiento los escriben quienes gestionan
-- ------------------------------------------------------------
drop policy if exists "seguimientos_crear" on public.seguimientos_incidencia;
create policy "seguimientos_crear" on public.seguimientos_incidencia
  for insert to authenticated with check (
    autor_id = auth.uid()
    and exists (
      select 1 from public.incidencias i
      where i.id = incidencia_id
        and public.puede_gestionar_incidencias(i.comunidad_id)
    )
  );

create index if not exists idx_seguimientos_incidencia
  on public.seguimientos_incidencia (incidencia_id, creado_en);
