-- ============================================================
-- Tabla de roles y permisos
-- ============================================================
-- Los permisos de la app dejan de estar fijados en el codigo: cada rol
-- guarda que puede hacer. Los roles son los cinco de la comunidad.

create table if not exists public.roles (
  clave text primary key,
  nombre text not null,
  descripcion text,
  orden integer not null default 0,
  es_admin_plataforma boolean not null default false,
  administra_comunidad boolean not null default false,
  gestiona_vecinos boolean not null default false,
  gestiona_documentos boolean not null default false,
  gestiona_incidencias boolean not null default false,
  ver_finanzas boolean not null default false,
  actualizado_en timestamptz not null default now(),
  constraint roles_clave_valida check (
    clave in (
      'administrador_plataforma',
      'presidente',
      'vicepresidente',
      'vocal',
      'vecino'
    )
  )
);

insert into public.roles (
  clave, nombre, descripcion, orden,
  es_admin_plataforma, administra_comunidad, gestiona_vecinos,
  gestiona_documentos, gestiona_incidencias, ver_finanzas
)
values
  (
    'administrador_plataforma',
    'Administrador Plataforma',
    'Acceso total a todas las comunidades y a este panel.',
    1, true, true, true, true, true, true
  ),
  (
    'presidente',
    'Presidente',
    'Administra la comunidad, sus vecinos, documentos e incidencias.',
    2, false, true, true, true, true, true
  ),
  (
    'vicepresidente',
    'Vicepresidente',
    'Sustituye al presidente y tiene los mismos permisos.',
    3, false, true, true, true, true, true
  ),
  (
    'vocal',
    'Vocal',
    'Junta directiva: documentos, incidencias y consulta de finanzas.',
    4, false, false, false, true, true, true
  ),
  (
    'vecino',
    'Vecino',
    'Consulta el tablon, sus datos y las incidencias de la comunidad.',
    5, false, false, false, false, false, false
  )
on conflict (clave) do nothing;

drop trigger if exists trg_roles_actualizado_en on public.roles;
create trigger trg_roles_actualizado_en
  before update on public.roles
  for each row execute function public.marcar_actualizado_en();

alter table public.roles enable row level security;

drop policy if exists "roles_lectura" on public.roles;
create policy "roles_lectura" on public.roles
  for select to authenticated using (true);

-- Los roles no se crean ni se borran desde la app: solo el administrador de
-- plataforma edita nombre, descripcion y permisos.
drop policy if exists "roles_edicion" on public.roles;
create policy "roles_edicion" on public.roles
  for update to authenticated
  using (public.es_admin_plataforma())
  with check (public.es_admin_plataforma());

-- ------------------------------------------------------------
-- Permisos efectivos: se leen de la tabla roles
-- ------------------------------------------------------------

-- Administrar la comunidad (datos, fincas, tablon, juntas, gastos...).
create or replace function public.es_administrador(p_comunidad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.miembros m
    left join public.roles r on r.clave = m.rol::text
    where m.comunidad_id = p_comunidad_id
      and m.usuario_id = auth.uid()
      and m.estado = 'activo'
      and coalesce(
        r.administra_comunidad,
        m.rol in ('presidente', 'vicepresidente', 'secretario')
      )
  );
$$;

-- Gestionar vecinos (altas, ediciones y bajas de miembros y titulares).
create or replace function public.puede_gestionar_vecinos(p_comunidad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.es_admin_plataforma()
    or exists (
      select 1
      from public.miembros m
      left join public.roles r on r.clave = m.rol::text
      where m.comunidad_id = p_comunidad_id
        and m.usuario_id = auth.uid()
        and m.estado = 'activo'
        and coalesce(
          r.gestiona_vecinos,
          m.rol in ('presidente', 'vicepresidente', 'secretario')
        )
    );
$$;

-- Subir y borrar documentos.
create or replace function public.puede_gestionar_documentos(p_comunidad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.es_admin_plataforma()
    or exists (
      select 1
      from public.miembros m
      left join public.roles r on r.clave = m.rol::text
      where m.comunidad_id = p_comunidad_id
        and m.usuario_id = auth.uid()
        and m.estado = 'activo'
        and coalesce(
          r.gestiona_documentos,
          m.rol in ('presidente', 'vicepresidente', 'vocal')
        )
    );
$$;

-- Cambiar el estado de las incidencias.
create or replace function public.puede_gestionar_incidencias(p_comunidad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.es_admin_plataforma()
    or exists (
      select 1
      from public.miembros m
      left join public.roles r on r.clave = m.rol::text
      where m.comunidad_id = p_comunidad_id
        and m.usuario_id = auth.uid()
        and m.estado = 'activo'
        and coalesce(
          r.gestiona_incidencias,
          m.rol in ('presidente', 'vicepresidente', 'vocal')
        )
    );
$$;

revoke all on function public.puede_gestionar_vecinos(uuid) from public;
grant execute on function public.puede_gestionar_vecinos(uuid) to authenticated;

-- ------------------------------------------------------------
-- Politicas que pasan a usar los permisos
-- ------------------------------------------------------------
drop policy if exists "miembros_escritura" on public.miembros;
create policy "miembros_escritura" on public.miembros
  for all to authenticated
  using (public.puede_gestionar_vecinos(comunidad_id))
  with check (public.puede_gestionar_vecinos(comunidad_id));

drop policy if exists "titulares_escritura" on public.titulares;
create policy "titulares_escritura" on public.titulares
  for all to authenticated
  using (
    public.puede_gestionar_vecinos(
      (select f.comunidad_id from public.fincas f where f.id = finca_id)
    )
  )
  with check (
    public.puede_gestionar_vecinos(
      (select f.comunidad_id from public.fincas f where f.id = finca_id)
    )
  );
