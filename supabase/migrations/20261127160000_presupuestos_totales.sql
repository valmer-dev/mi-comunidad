-- ============================================================
-- Presupuestos: totales calculados a partir de sus partidas
-- ============================================================
-- Las tablas presupuestos y partidas_presupuesto existen desde el esquema
-- inicial pero ninguna pantalla las usaba. Los totales del presupuesto se
-- mantienen solos al anadir, cambiar o quitar partidas.
--
-- Ademas, un presupuesto aprobado o cerrado no se puede tocar: hay que
-- devolverlo a borrador primero, para que lo aprobado en junta no cambie
-- sin querer.

create or replace function public.recalcular_presupuesto(p_presupuesto_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.presupuestos p
     set total_gastos = coalesce((
           select sum(importe) from public.partidas_presupuesto
            where presupuesto_id = p.id and tipo = 'gasto'
         ), 0),
         total_ingresos = coalesce((
           select sum(importe) from public.partidas_presupuesto
            where presupuesto_id = p.id and tipo = 'ingreso'
         ), 0)
   where p.id = p_presupuesto_id;
$$;

revoke all on function public.recalcular_presupuesto(uuid) from public;

create or replace function public.tr_partidas_presupuesto()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_estado public.estado_presupuesto;
begin
  select estado into v_estado
    from public.presupuestos
   where id = coalesce(new.presupuesto_id, old.presupuesto_id);

  if v_estado is not null and v_estado <> 'borrador' then
    raise exception 'El presupuesto ya esta aprobado: vuelve a borrador para cambiarlo'
      using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' and old.presupuesto_id <> new.presupuesto_id then
    perform public.recalcular_presupuesto(old.presupuesto_id);
  end if;
  if tg_op = 'DELETE' then
    perform public.recalcular_presupuesto(old.presupuesto_id);
  else
    perform public.recalcular_presupuesto(new.presupuesto_id);
  end if;
  return null;
end;
$$;

drop trigger if exists tr_partidas_presupuesto on public.partidas_presupuesto;
create trigger tr_partidas_presupuesto
  after insert or update or delete on public.partidas_presupuesto
  for each row execute function public.tr_partidas_presupuesto();

create index if not exists idx_partidas_presupuesto
  on public.partidas_presupuesto (presupuesto_id);
