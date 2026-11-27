-- ============================================================
-- Rol de administrador de fincas y permiso para editar finanzas
-- ============================================================
--
-- Hasta ahora solo el presidente (y el administrador de la plataforma) podia
-- editar la parte economica, y el administrador de fincas no se podia
-- asignar. Ahora "editar finanzas" es un permiso mas de la tabla roles y el
-- administrador de fincas tiene su propia fila, editable desde Plataforma.

alter table public.roles
  add column if not exists edita_finanzas boolean not null default false;

alter table public.roles drop constraint if exists roles_clave_valida;
alter table public.roles
  add constraint roles_clave_valida check (
    clave in (
      'administrador_plataforma',
      'presidente',
      'vicepresidente',
      'vocal',
      'vecino',
      'administrador_fincas'
    )
  );

-- Se mantiene lo que habia: solo presidente y plataforma editan finanzas.
update public.roles
   set edita_finanzas = true
 where clave in ('administrador_plataforma', 'presidente');

-- El administrador de fincas lleva la gestion diaria de la comunidad.
insert into public.roles (
  clave, nombre, descripcion, orden, es_admin_plataforma,
  administra_comunidad, gestiona_vecinos, gestiona_documentos,
  gestiona_incidencias, ver_finanzas, edita_finanzas
) values (
  'administrador_fincas',
  'Administrador de fincas',
  'Profesional contratado por la comunidad: lleva las finanzas, las juntas, los documentos y las incidencias.',
  6, false,
  true, true, true,
  true, true, true
)
on conflict (clave) do nothing;

-- El permiso se lee de la tabla roles, como el resto. Sin fila, solo el
-- presidente (comportamiento anterior).
create or replace function public.puede_editar_finanzas(p_comunidad_id uuid)
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
          and coalesce(r.edita_finanzas, m.rol = 'presidente')
      );
$$;

revoke all on function public.puede_editar_finanzas(uuid) from public;
grant execute on function public.puede_editar_finanzas(uuid) to authenticated;
