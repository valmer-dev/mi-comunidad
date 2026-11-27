-- ============================================================
-- Recibos por vivienda, cobros y estado de cuentas
-- ============================================================
-- Las tablas recibos y pagos existen desde el esquema inicial pero ninguna
-- pantalla las usaba. Esta migracion las prepara para:
--   1. Generar los recibos de un periodo repartiendo un importe total segun
--      el coeficiente de cada finca (art. 9.1.e LPH).
--   2. Registrar cobros totales o parciales: el estado del recibo se calcula
--      solo a partir de sus pagos.
--   3. Marcar devoluciones bancarias y anular recibos.
--   4. Proteger la deuda de cada vecino: cada titular ve sus recibos y la
--      junta directiva ve todos. El resto de vecinos ya no ve los recibos
--      ajenos aunque tenga permiso para ver las finanzas generales.

-- ------------------------------------------------------------
-- 1. Lectura: titulares de la finca, junta directiva y finanzas
-- ------------------------------------------------------------
drop policy if exists "recibos_lectura" on public.recibos;
create policy "recibos_lectura" on public.recibos
  for select to authenticated using (
    public.es_titular_de(finca_id)
    or public.es_administrador(comunidad_id)
    or public.puede_editar_finanzas(comunidad_id)
  );

drop policy if exists "pagos_lectura" on public.pagos;
create policy "pagos_lectura" on public.pagos
  for select to authenticated using (
    exists (
      select 1 from public.recibos r
       where r.id = recibo_id
         and (
           public.es_titular_de(r.finca_id)
           or public.es_administrador(r.comunidad_id)
           or public.puede_editar_finanzas(r.comunidad_id)
         )
    )
  );

create index if not exists idx_recibos_comunidad_periodo
  on public.recibos (comunidad_id, periodo);
create index if not exists idx_pagos_recibo on public.pagos (recibo_id);

-- ------------------------------------------------------------
-- 2. El estado del recibo sale de sus pagos
-- ------------------------------------------------------------
-- pagado si lo cobrado cubre el importe; si no, pendiente, salvo que se haya
-- marcado a mano como devuelto, aplazado o anulado.
create or replace function public.recalcular_recibo(p_recibo_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cobrado numeric(12,2);
  v_ultimo date;
begin
  select coalesce(sum(importe), 0), max(fecha)
    into v_cobrado, v_ultimo
    from public.pagos
   where recibo_id = p_recibo_id;

  update public.recibos r
     set estado = case
                    when r.estado = 'anulado' then r.estado
                    when v_cobrado >= r.importe and r.importe > 0 then 'pagado'
                    when r.estado in ('devuelto', 'aplazado') then r.estado
                    else 'pendiente'
                  end,
         pagado_en = case
                       when v_cobrado >= r.importe and r.importe > 0 then v_ultimo
                       else null
                     end
   where r.id = p_recibo_id;
end;
$$;

revoke all on function public.recalcular_recibo(uuid) from public;

create or replace function public.tr_pagos_recalcular()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recalcular_recibo(old.recibo_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recalcular_recibo(new.recibo_id);
  end if;
  return null;
end;
$$;

drop trigger if exists tr_pagos_recalcular on public.pagos;
create trigger tr_pagos_recalcular
  after insert or update or delete on public.pagos
  for each row execute function public.tr_pagos_recalcular();

-- ------------------------------------------------------------
-- 3. Generar los recibos de un periodo
-- ------------------------------------------------------------
-- Reparte p_importe_total entre las fincas con coeficiente mayor que 0. Los
-- centimos que sobran del redondeo van a las fincas de mayor coeficiente para
-- que la suma de los recibos sea exactamente el total. Si una finca ya tiene
-- un recibo con el mismo periodo y concepto, no se duplica.
create or replace function public.generar_recibos(
  p_comunidad_id uuid,
  p_periodo date,
  p_concepto text,
  p_importe_total numeric,
  p_vence_en date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_periodo date := date_trunc('month', p_periodo)::date;
  v_concepto text := nullif(trim(p_concepto), '');
  v_total_centimos bigint;
  v_suma_coef numeric;
  v_creados integer := 0;
  v_omitidos integer := 0;
  v_fincas integer := 0;
begin
  if not public.puede_editar_finanzas(p_comunidad_id) then
    raise exception 'Sin permiso para generar recibos' using errcode = '42501';
  end if;

  if p_periodo is null or v_concepto is null then
    raise exception 'Faltan el periodo o el concepto' using errcode = '22023';
  end if;

  if p_importe_total is null or p_importe_total <= 0 then
    raise exception 'El importe total debe ser mayor que cero' using errcode = '22023';
  end if;

  v_total_centimos := round(p_importe_total * 100);

  select coalesce(sum(coeficiente), 0), count(*)
    into v_suma_coef, v_fincas
    from public.fincas
   where comunidad_id = p_comunidad_id
     and coeficiente > 0;

  if v_fincas = 0 or v_suma_coef = 0 then
    raise exception 'Ninguna finca tiene coeficiente' using errcode = '22023';
  end if;

  insert into public.recibos (comunidad_id, finca_id, periodo, concepto, importe, vence_en)
  with base as (
    select f.id, f.coeficiente, f.tipo, f.numero, f.codigo,
           floor(v_total_centimos * f.coeficiente / v_suma_coef)::bigint as centimos
      from public.fincas f
     where f.comunidad_id = p_comunidad_id
       and f.coeficiente > 0
  ),
  resto as (
    select v_total_centimos - coalesce(sum(centimos), 0) as centimos from base
  ),
  -- Un centimo mas a las fincas de mayor coeficiente hasta cuadrar
  reparto as (
    select b.id,
           b.centimos
             + case
                 when row_number() over (order by b.coeficiente desc, b.tipo, b.numero, b.codigo)
                      <= (select centimos from resto)
                 then 1 else 0
               end as centimos
      from base b
  )
  select p_comunidad_id, r.id, v_periodo, v_concepto, r.centimos / 100.0, p_vence_en
    from reparto r
  on conflict (finca_id, periodo, concepto) do nothing;
  get diagnostics v_creados = row_count;

  v_omitidos := v_fincas - v_creados;

  return jsonb_build_object(
    'creados', v_creados,
    'omitidos', v_omitidos,
    'fincas', v_fincas,
    'total', round(v_total_centimos / 100.0, 2)
  );
end;
$$;

revoke all on function public.generar_recibos(uuid, date, text, numeric, date) from public;
grant execute on function public.generar_recibos(uuid, date, text, numeric, date) to authenticated;

-- ------------------------------------------------------------
-- 4. Devolucion bancaria
-- ------------------------------------------------------------
-- El banco devuelve el cargo: se borran los cobros del recibo y queda como
-- devuelto, con la nota de por que.
create or replace function public.devolver_recibo(
  p_recibo_id uuid,
  p_nota text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_comunidad uuid;
begin
  select comunidad_id into v_comunidad from public.recibos where id = p_recibo_id;
  if v_comunidad is null then
    raise exception 'El recibo no existe' using errcode = '22023';
  end if;
  if not public.puede_editar_finanzas(v_comunidad) then
    raise exception 'Sin permiso para devolver recibos' using errcode = '42501';
  end if;

  delete from public.pagos where recibo_id = p_recibo_id;

  update public.recibos
     set estado = 'devuelto',
         pagado_en = null,
         notas = case
                   when nullif(trim(p_nota), '') is null then notas
                   else trim(both e'\n' from concat_ws(e'\n', notas, 'Devuelto: ' || trim(p_nota)))
                 end
   where id = p_recibo_id;
end;
$$;

revoke all on function public.devolver_recibo(uuid, text) from public;
grant execute on function public.devolver_recibo(uuid, text) to authenticated;
