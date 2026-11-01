-- ============================================================
-- Los pisos se identifican como 1ºA, 1ºB, 2ºA, 2ºB...
-- (dos puertas por planta)
-- ============================================================

-- ------------------------------------------------------------
-- Renombrar los pisos existentes sin perder a sus titulares.
-- Primero pasan por un codigo temporal para no chocar con la
-- restriccion unique (comunidad_id, codigo).
-- ------------------------------------------------------------
update public.fincas
   set codigo = '__piso_tmp__' || id::text
 where tipo = 'piso'
   and codigo like 'Piso %';

do $$
declare
  v_comunidad uuid;
  v_id uuid;
  v_contador integer;
  v_planta integer;
  v_letra text;
begin
  for v_comunidad in
    select distinct comunidad_id
      from public.fincas
     where tipo = 'piso'
       and codigo like '__piso_tmp__%'
  loop
    v_contador := 0;
    for v_id in
      select id
        from public.fincas
       where comunidad_id = v_comunidad
         and codigo like '__piso_tmp__%'
       order by coalesce(numero, 999999), codigo
    loop
      v_contador := v_contador + 1;
      v_planta := ((v_contador - 1) / 2) + 1;
      v_letra := chr(64 + (((v_contador - 1) % 2) + 1));

      update public.fincas
         set codigo = v_planta || 'º' || v_letra,
             planta = v_planta || 'º',
             puerta = v_letra,
             numero = v_contador
       where id = v_id;
    end loop;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Generacion de fincas: casas "Casa N" y pisos "1ºA", "1ºB"...
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
  v_planta integer;
  v_planta_texto text;
  v_letra text;
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
    v_planta := ((i - 1) / 2) + 1;
    v_letra := chr(64 + (((i - 1) % 2) + 1));
    v_codigos := array_append(v_codigos, v_planta || 'º' || v_letra);
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
      v_planta_texto := null;
      v_letra := null;
    else
      v_tipo := 'piso';
      v_numero := i - p_casas;
      v_planta := ((v_numero - 1) / 2) + 1;
      v_letra := chr(64 + (((v_numero - 1) % 2) + 1));
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
