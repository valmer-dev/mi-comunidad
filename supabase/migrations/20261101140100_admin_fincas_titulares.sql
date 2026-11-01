-- ============================================================
-- Administrador de plataforma, numero de casas y pisos,
-- roles simplificados y segundo titular.
-- ============================================================

-- ------------------------------------------------------------
-- Administrador de plataforma
-- ------------------------------------------------------------
alter table public.perfiles
  add column if not exists es_admin_plataforma boolean not null default false;

comment on column public.perfiles.es_admin_plataforma is
  'Puede gestionar cualquier comunidad y crear comunidades nuevas desde /plataforma.';

-- ------------------------------------------------------------
-- Numero de casas y pisos de la comunidad
-- ------------------------------------------------------------
alter table public.comunidades
  add column if not exists numero_casas integer not null default 0
    check (numero_casas >= 0 and numero_casas <= 500),
  add column if not exists numero_pisos integer not null default 0
    check (numero_pisos >= 0 and numero_pisos <= 500);

-- ------------------------------------------------------------
-- Numero de finca (Casa 1, Piso 4...)
-- ------------------------------------------------------------
alter table public.fincas add column if not exists numero integer;

create index if not exists idx_fincas_tipo
  on public.fincas (comunidad_id, tipo, numero);

-- ------------------------------------------------------------
-- Titulares sin cuenta: el segundo titular puede ser solo un nombre
-- ------------------------------------------------------------
alter table public.titulares alter column usuario_id drop not null;
alter table public.titulares add column if not exists nombre text;

alter table public.titulares drop constraint if exists titulares_con_alguien;
alter table public.titulares
  add constraint titulares_con_alguien
  check (usuario_id is not null or (nombre is not null and length(btrim(nombre)) > 0));

-- ------------------------------------------------------------
-- Rol por defecto: vecino
-- ------------------------------------------------------------
alter table public.miembros alter column rol set default 'vecino'::public.rol_miembro;

update public.miembros
   set rol = 'vecino'
 where rol in ('propietario', 'inquilino');

-- ------------------------------------------------------------
-- Funcion de permisos
-- ------------------------------------------------------------
create or replace function public.es_admin_plataforma()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.perfiles p
     where p.id = auth.uid()
       and p.es_admin_plataforma
  );
$$;

revoke all on function public.es_admin_plataforma() from public;
grant execute on function public.es_admin_plataforma() to authenticated;

-- ------------------------------------------------------------
-- El administrador de plataforma puede con todo
-- (las politicas son permisivas: se suman a las que ya existen)
-- ------------------------------------------------------------
do $$
declare
  tabla text;
  tablas text[] := array[
    'comunidades', 'perfiles', 'fincas', 'miembros', 'titulares',
    'invitaciones', 'categorias_gasto', 'proveedores', 'presupuestos',
    'partidas_presupuesto', 'gastos', 'recibos', 'pagos',
    'incidencias', 'seguimientos_incidencia', 'documentos', 'anuncios',
    'lecturas_anuncio', 'juntas', 'puntos_del_dia', 'asistencias',
    'votos', 'acuerdos', 'zonas_comunes', 'reservas',
    'notificaciones', 'auditoria'
  ];
begin
  foreach tabla in array tablas loop
    execute format('drop policy if exists %I on public.%I', 'admin_plataforma', tabla);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.es_admin_plataforma()) with check (public.es_admin_plataforma())',
      'admin_plataforma',
      tabla
    );
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Crear o reajustar las casas y los pisos de una comunidad
-- ------------------------------------------------------------
create or replace function public.configurar_fincas(
  p_comunidad_id uuid,
  p_casas integer,
  p_pisos integer
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_codigos text[] := '{}';
  v_total integer;
  v_coef numeric(8,4);
  v_acumulado numeric(8,4) := 0;
  v_eliminadas integer := 0;
  v_creadas integer := 0;
  v_posicion integer := 0;
  i integer;
  v_tipo public.tipo_finca;
  v_codigo text;
  v_numero integer;
  r record;
begin
  if p_casas is null or p_pisos is null or p_casas < 0 or p_pisos < 0 then
    raise exception 'El numero de casas y de pisos no es valido';
  end if;

  -- Codigos deseados
  for i in 1..p_casas loop
    v_codigos := array_append(v_codigos, 'Casa ' || i);
  end loop;
  for i in 1..p_pisos loop
    v_codigos := array_append(v_codigos, 'Piso ' || i);
  end loop;

  -- Fuera las casas y pisos que ya no se piden y no tienen ningun titular
  delete from public.fincas f
   where f.comunidad_id = p_comunidad_id
     and f.tipo in ('casa', 'piso')
     and not (f.codigo = any (v_codigos))
     and not exists (select 1 from public.titulares t where t.finca_id = f.id);
  get diagnostics v_eliminadas = row_count;

  -- Crear las que faltan
  for i in 1..(p_casas + p_pisos) loop
    if i <= p_casas then
      v_tipo := 'casa';
      v_numero := i;
      v_codigo := 'Casa ' || i;
    else
      v_tipo := 'piso';
      v_numero := i - p_casas;
      v_codigo := 'Piso ' || (i - p_casas);
    end if;

    insert into public.fincas (comunidad_id, codigo, tipo, numero, coeficiente)
    values (p_comunidad_id, v_codigo, v_tipo, v_numero, 0)
    on conflict (comunidad_id, codigo) do nothing;

    if found then
      v_creadas := v_creadas + 1;
    end if;
  end loop;

  -- Reparto equitativo del coeficiente entre casas y pisos
  v_total := p_casas + p_pisos;
  if v_total > 0 then
    for r in
      select id
        from public.fincas
       where comunidad_id = p_comunidad_id
         and tipo in ('casa', 'piso')
         and codigo = any (v_codigos)
       order by (tipo = 'piso'), numero, codigo
    loop
      v_posicion := v_posicion + 1;
      v_coef := trunc(100.0 / v_total, 4);
      if v_posicion >= v_total then
        v_coef := 100 - v_acumulado;
      end if;
      update public.fincas set coeficiente = v_coef where id = r.id;
      v_acumulado := v_acumulado + v_coef;
    end loop;
  end if;

  update public.comunidades
     set numero_casas = p_casas,
         numero_pisos = p_pisos
   where id = p_comunidad_id;

  return jsonb_build_object(
    'creadas', v_creadas,
    'eliminadas', v_eliminadas,
    'total', v_total
  );
end;
$$;

revoke all on function public.configurar_fincas(uuid, integer, integer) from public;
grant execute on function public.configurar_fincas(uuid, integer, integer) to authenticated;

-- ------------------------------------------------------------
-- Este usuario pasa a ser administrador de la plataforma
-- ------------------------------------------------------------
update public.perfiles
   set es_admin_plataforma = true
 where lower(correo) = 'jcvalverde1996@gmail.com';
