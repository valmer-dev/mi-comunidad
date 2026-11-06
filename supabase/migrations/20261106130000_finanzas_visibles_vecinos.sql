-- ============================================================
-- Finanzas visibles para los vecinos (solo lectura)
-- ============================================================

-- El permiso ver_finanzas pasa a leerse de la tabla roles, igual que el resto
-- de permisos, para que el rol vecino pueda consultar las finanzas.
create or replace function public.puede_ver_finanzas(p_comunidad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.es_admin_plataforma()
      or exists (
        select 1
        from public.miembros m
        left join public.roles r on r.clave = m.rol::text
        where m.comunidad_id = p_comunidad_id
          and m.usuario_id = auth.uid()
          and m.estado = 'activo'
          and coalesce(
            r.ver_finanzas,
            m.rol in (
              'presidente',
              'vicepresidente',
              'secretario',
              'vocal',
              'administrador_fincas'
            )
          )
      );
$$;

revoke all on function public.puede_ver_finanzas(uuid) from public;
grant execute on function public.puede_ver_finanzas(uuid) to authenticated;

-- Los vecinos pueden consultar las finanzas. La escritura sigue reservada al
-- presidente y al administrador de plataforma mediante puede_editar_finanzas.
update public.roles
   set ver_finanzas = true
 where clave = 'vecino';
