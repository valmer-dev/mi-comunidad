-- ============================================================
-- Coeficientes de participacion por finca
-- ============================================================
-- La LPH (art. 5 y 9.1.e) reparte gastos y computa votos segun la cuota
-- fijada en el titulo constitutivo, que casi nunca es igual para todas las
-- viviendas. Hasta ahora configurar_fincas repartia el 100 % a partes iguales
-- cada vez que se guardaban las casas y los pisos, asi que no habia forma de
-- poner el coeficiente real de cada finca.
--
-- 1. configurar_fincas ya no pisa los coeficientes: solo reparte a partes
--    iguales si se pide (p_repartir) o si todavia no hay ninguno puesto.
-- 2. guardar_coeficientes guarda de una vez el coeficiente de todas las
--    fincas, comprobando que la suma es el coeficiente total de la comunidad.
--    Las juntas que aun no se han celebrado toman los coeficientes nuevos.

-- ------------------------------------------------------------
-- 1. configurar_fincas con reparto opcional
-- ------------------------------------------------------------
drop function if exists public.configurar_fincas(uuid, integer, integer);

create or replace function public.configurar_fincas(
  p_comunidad_id uuid,
  p_casas integer,
  p_pisos integer,
  p_repartir boolean default false
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_puertas constant integer := 4;
  v_codigos text[] := '{}';
  v_total integer;
  v_coef numeric(8,4);
  v_acumulado numeric(8,4) := 0;
  v_eliminadas integer := 0;
  v_creadas integer := 0;
  v_posicion integer := 0;
  v_suma numeric(12,4);
  v_repartido boolean := false;
  v_coeficiente_total numeric(8,4);
  i integer;
  v_tipo public.tipo_finca;
  v_codigo text;
  v_numero integer;
  v_planta integer;
  v_planta_texto text;
  v_letra text;
  r record;
begin
  if p_casas is null or p_pisos is null or p_casas < 0 or p_pisos < 0 then
    raise exception 'El numero de casas y de pisos no es valido';
  end if;

  select coeficiente_total
    into v_coeficiente_total
    from public.comunidades
   where id = p_comunidad_id;

  -- Codigos deseados
  for i in 1..p_casas loop
    v_codigos := array_append(v_codigos, 'Casa ' || i);
  end loop;
  for i in 1..p_pisos loop
    v_planta := ((i - 1) / v_puertas) + 1;
    v_letra := chr(64 + (((i - 1) % v_puertas) + 1));
    v_codigos := array_append(v_codigos, v_planta || 'º' || v_letra);
  end loop;

  -- Fuera las casas y pisos que ya no se piden y no tienen ningun titular
  delete from public.fincas f
   where f.comunidad_id = p_comunidad_id
     and f.tipo in ('casa', 'piso')
     and not (f.codigo = any (v_codigos))
     and not exists (select 1 from public.titulares t where t.finca_id = f.id);
  get diagnostics v_eliminadas = row_count;

  -- Crear las que faltan (con coeficiente 0 hasta que se indique el real)
  for i in 1..(p_casas + p_pisos) loop
    if i <= p_casas then
      v_tipo := 'casa';
      v_numero := i;
      v_codigo := 'Casa ' || i;
      v_planta_texto := null;
      v_letra := null;
    else
      v_tipo := 'piso';
      v_numero := i - p_casas;
      v_planta := ((v_numero - 1) / v_puertas) + 1;
      v_letra := chr(64 + (((v_numero - 1) % v_puertas) + 1));
      v_planta_texto := v_planta || 'º';
      v_codigo := v_planta_texto || v_letra;
    end if;

    insert into public.fincas (comunidad_id, codigo, tipo, numero, coeficiente, planta, puerta)
    values (p_comunidad_id, v_codigo, v_tipo, v_numero, 0, v_planta_texto, v_letra)
    on conflict (comunidad_id, codigo) do nothing;

    if found then
      v_creadas := v_creadas + 1;
    end if;
  end loop;

  -- Alinear numero, planta y puerta de los pisos que ya existian
  for i in 1..p_pisos loop
    v_planta := ((i - 1) / v_puertas) + 1;
    v_letra := chr(64 + (((i - 1) % v_puertas) + 1));

    update public.fincas
       set numero = i,
           planta = v_planta || 'º',
           puerta = v_letra
     where comunidad_id = p_comunidad_id
       and codigo = v_planta || 'º' || v_letra;
  end loop;

  select coalesce(sum(coeficiente), 0)
    into v_suma
    from public.fincas
   where comunidad_id = p_comunidad_id;

  -- Reparto a partes iguales solo si se pide o si aun no hay coeficientes
  v_total := p_casas + p_pisos;
  if v_total > 0 and (coalesce(p_repartir, false) or v_suma = 0) then
    -- El reparto es solo entre casas y pisos: el resto de fincas queda a 0
    update public.fincas
       set coeficiente = 0
     where comunidad_id = p_comunidad_id
       and not (tipo in ('casa', 'piso') and codigo = any (v_codigos));

    for r in
      select id
        from public.fincas
       where comunidad_id = p_comunidad_id
         and tipo in ('casa', 'piso')
         and codigo = any (v_codigos)
       order by (tipo = 'piso'), numero, codigo
    loop
      v_posicion := v_posicion + 1;
      v_coef := trunc(coalesce(v_coeficiente_total, 100) / v_total, 4);
      if v_posicion >= v_total then
        v_coef := coalesce(v_coeficiente_total, 100) - v_acumulado;
      end if;
      update public.fincas set coeficiente = v_coef where id = r.id;
      v_acumulado := v_acumulado + v_coef;
    end loop;
    v_repartido := true;
  end if;

  update public.comunidades
     set numero_casas = p_casas,
         numero_pisos = p_pisos
   where id = p_comunidad_id;

  return jsonb_build_object(
    'creadas', v_creadas,
    'eliminadas', v_eliminadas,
    'total', v_total,
    'repartido', v_repartido
  );
end;
$$;

revoke all on function public.configurar_fincas(uuid, integer, integer, boolean) from public;
grant execute on function public.configurar_fincas(uuid, integer, integer, boolean) to authenticated;

-- ------------------------------------------------------------
-- 2. Guardar los coeficientes de todas las fincas de una vez
-- ------------------------------------------------------------
-- p_coeficientes: [{"id": "<finca>", "coeficiente": 12.3456}, ...]
-- Tiene que incluir todas las fincas de la comunidad y sumar exactamente el
-- coeficiente total (100 salvo que la comunidad tenga otro).
create or replace function public.guardar_coeficientes(
  p_comunidad_id uuid,
  p_coeficientes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_coeficiente_total numeric(8,4);
  v_suma numeric(12,4);
  v_recibidas integer;
  v_fincas integer;
  v_validas integer;
  v_juntas integer := 0;
begin
  if not (public.es_administrador(p_comunidad_id) or public.es_admin_plataforma()) then
    raise exception 'Sin permiso para cambiar los coeficientes' using errcode = '42501';
  end if;

  if p_coeficientes is null or jsonb_typeof(p_coeficientes) <> 'array' then
    raise exception 'Formato de coeficientes no valido' using errcode = '22023';
  end if;

  select coeficiente_total
    into v_coeficiente_total
    from public.comunidades
   where id = p_comunidad_id;

  if not found then
    raise exception 'La comunidad no existe' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_coeficientes) e
     where jsonb_typeof(e -> 'id') <> 'string'
        or jsonb_typeof(e -> 'coeficiente') <> 'number'
  ) then
    raise exception 'Hay coeficientes no validos' using errcode = '22023';
  end if;

  if exists (
    select 1 from (
      select (e ->> 'id')::uuid as finca_id,
             round((e ->> 'coeficiente')::numeric, 4) as coeficiente
        from jsonb_array_elements(p_coeficientes) e
    ) t
     where finca_id is null or coeficiente is null or coeficiente < 0 or coeficiente > 100
  ) then
    raise exception 'Hay coeficientes no validos' using errcode = '22023';
  end if;

  select count(*), count(distinct finca_id), coalesce(sum(coeficiente), 0)
    into v_recibidas, v_validas, v_suma
    from (
      select (e ->> 'id')::uuid as finca_id,
             round((e ->> 'coeficiente')::numeric, 4) as coeficiente
        from jsonb_array_elements(p_coeficientes) e
    ) t;

  select count(*) into v_fincas
    from public.fincas
   where comunidad_id = p_comunidad_id;

  if v_recibidas <> v_validas then
    raise exception 'Hay fincas repetidas' using errcode = '22023';
  end if;

  if v_recibidas <> v_fincas or exists (
    select 1 from (
      select (e ->> 'id')::uuid as finca_id,
             round((e ->> 'coeficiente')::numeric, 4) as coeficiente
        from jsonb_array_elements(p_coeficientes) e
    ) t
     where not exists (
       select 1 from public.fincas f
        where f.id = t.finca_id and f.comunidad_id = p_comunidad_id
     )
  ) then
    raise exception 'Faltan fincas o alguna no es de la comunidad' using errcode = '22023';
  end if;

  if v_suma <> v_coeficiente_total then
    raise exception 'Los coeficientes suman % y deben sumar %', v_suma, v_coeficiente_total
      using errcode = '22023';
  end if;

  update public.fincas f
     set coeficiente = t.coeficiente
    from (
      select (e ->> 'id')::uuid as finca_id,
             round((e ->> 'coeficiente')::numeric, 4) as coeficiente
        from jsonb_array_elements(p_coeficientes) e
    ) t
   where f.id = t.finca_id
     and f.coeficiente is distinct from t.coeficiente;

  -- Las juntas que aun no se han celebrado usan los coeficientes nuevos.
  -- Las celebradas y cerradas conservan los de su dia.
  update public.asistencias a
     set coeficiente = f.coeficiente
    from public.fincas f, public.juntas j
   where a.finca_id = f.id
     and a.junta_id = j.id
     and j.comunidad_id = p_comunidad_id
     and j.estado in ('borrador', 'convocada')
     and a.coeficiente is distinct from f.coeficiente;
  get diagnostics v_juntas = row_count;

  return jsonb_build_object(
    'fincas', v_fincas,
    'suma', v_suma,
    'asistencias_actualizadas', v_juntas
  );
end;
$$;

revoke all on function public.guardar_coeficientes(uuid, jsonb) from public;
grant execute on function public.guardar_coeficientes(uuid, jsonb) to authenticated;
