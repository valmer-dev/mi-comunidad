-- ============================================================
-- Ingresos, saldo en cuenta y fondo de reserva
-- ============================================================
-- Finanzas solo registraba gastos. Para saber cuanto dinero tiene la
-- comunidad hace falta:
--   1. Otros ingresos ademas de las cuotas (alquiler de la azotea,
--      subvenciones, intereses...). Las cuotas cobradas ya estan en pagos.
--   2. Un saldo inicial con su fecha, para que el saldo de la app coincida
--      con el del banco: saldo = inicial + cobros + ingresos - gastos desde
--      esa fecha.
--   3. El fondo de reserva (art. 9.1.f LPH): parte del saldo apartada para
--      obras de conservacion. No puede ser inferior al 10 % del ultimo
--      presupuesto ordinario. Se lleva con movimientos (dotaciones y
--      disposiciones) para que quede constancia de cada cambio.

-- ------------------------------------------------------------
-- 1. Saldo inicial
-- ------------------------------------------------------------
alter table public.comunidades
  add column if not exists saldo_inicial numeric(12,2) not null default 0,
  add column if not exists saldo_inicial_fecha date;

-- ------------------------------------------------------------
-- 2. Otros ingresos
-- ------------------------------------------------------------
create table if not exists public.ingresos (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  fecha date not null default current_date,
  concepto text not null,
  importe numeric(12,2) not null check (importe > 0),
  categoria_id uuid references public.categorias_gasto (id) on delete set null,
  creado_por uuid references public.perfiles (id) on delete set null,
  creado_en timestamptz not null default now()
);

create index if not exists idx_ingresos_comunidad_fecha
  on public.ingresos (comunidad_id, fecha);

alter table public.ingresos enable row level security;

drop policy if exists "ingresos_lectura" on public.ingresos;
create policy "ingresos_lectura" on public.ingresos
  for select to authenticated using (public.puede_ver_finanzas(comunidad_id));

drop policy if exists "ingresos_escritura" on public.ingresos;
create policy "ingresos_escritura" on public.ingresos
  for all to authenticated
  using (public.puede_editar_finanzas(comunidad_id))
  with check (public.puede_editar_finanzas(comunidad_id));

-- ------------------------------------------------------------
-- 3. Fondo de reserva
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_movimiento_fondo') then
    create type public.tipo_movimiento_fondo as enum ('dotacion', 'disposicion');
  end if;
end;
$$;

create table if not exists public.movimientos_fondo (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  fecha date not null default current_date,
  tipo public.tipo_movimiento_fondo not null,
  concepto text not null,
  importe numeric(12,2) not null check (importe > 0),
  creado_por uuid references public.perfiles (id) on delete set null,
  creado_en timestamptz not null default now()
);

create index if not exists idx_movimientos_fondo_comunidad
  on public.movimientos_fondo (comunidad_id, fecha);

alter table public.movimientos_fondo enable row level security;

drop policy if exists "movimientos_fondo_lectura" on public.movimientos_fondo;
create policy "movimientos_fondo_lectura" on public.movimientos_fondo
  for select to authenticated using (public.puede_ver_finanzas(comunidad_id));

drop policy if exists "movimientos_fondo_escritura" on public.movimientos_fondo;
create policy "movimientos_fondo_escritura" on public.movimientos_fondo
  for all to authenticated
  using (public.puede_editar_finanzas(comunidad_id))
  with check (public.puede_editar_finanzas(comunidad_id));

-- El fondo nunca puede quedar en negativo
create or replace function public.comprobar_fondo_reserva()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_saldo numeric(12,2);
  v_comunidad uuid := coalesce(new.comunidad_id, old.comunidad_id);
begin
  select coalesce(sum(case when tipo = 'dotacion' then importe else -importe end), 0)
    into v_saldo
    from public.movimientos_fondo
   where comunidad_id = v_comunidad;

  if v_saldo < 0 then
    raise exception 'El fondo de reserva no puede quedar en negativo' using errcode = '22023';
  end if;
  return null;
end;
$$;

drop trigger if exists tr_movimientos_fondo_comprobar on public.movimientos_fondo;
create trigger tr_movimientos_fondo_comprobar
  after insert or update or delete on public.movimientos_fondo
  for each row execute function public.comprobar_fondo_reserva();

-- Lectura agregada de los cobros de cuotas para quien ve las finanzas
-- generales. Desde la migracion de recibos un vecino solo ve sus pagos, pero
-- el total cobrado por la comunidad es informacion de todos.
create or replace function public.cobros_por_mes(
  p_comunidad_id uuid,
  p_desde date,
  p_hasta date
)
returns table (mes date, total numeric)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select date_trunc('month', p.fecha)::date as mes, sum(p.importe) as total
    from public.pagos p
    join public.recibos r on r.id = p.recibo_id
   where r.comunidad_id = p_comunidad_id
     and p.fecha between p_desde and p_hasta
     and public.puede_ver_finanzas(p_comunidad_id)
   group by 1
   order by 1;
$$;

revoke all on function public.cobros_por_mes(uuid, date, date) from public;
grant execute on function public.cobros_por_mes(uuid, date, date) to authenticated;

-- ------------------------------------------------------------
-- Permisos de las tablas nuevas (las politicas RLS deciden el resto)
-- ------------------------------------------------------------
grant select, insert, update, delete on public.ingresos, public.movimientos_fondo to authenticated;
grant all on public.ingresos, public.movimientos_fondo to service_role;
