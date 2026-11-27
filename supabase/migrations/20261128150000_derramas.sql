-- Derramas (punto 10 del informe de administrador de fincas).
--
-- Una derrama es un gasto extraordinario aprobado en junta que se reparte
-- por coeficiente en uno o varios plazos. Cada plazo genera sus propios
-- recibos, separados de la cuota ordinaria y enlazados a la derrama.

create table if not exists public.derramas (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  titulo text not null check (length(trim(titulo)) between 2 and 120),
  descripcion text,
  importe_total numeric(12,2) not null check (importe_total > 0),
  plazos integer not null check (plazos between 1 and 60),
  primer_vencimiento date not null,
  meses_entre_plazos integer not null default 1 check (meses_entre_plazos between 1 and 12),
  -- Acuerdo de junta que la aprueba
  punto_id uuid references public.puntos_del_dia (id) on delete set null,
  anulada_en timestamptz,
  creado_por uuid references public.perfiles (id) on delete set null,
  creado_en timestamptz not null default now()
);

create index if not exists idx_derramas_comunidad on public.derramas (comunidad_id, creado_en desc);

alter table public.recibos
  add column if not exists derrama_id uuid references public.derramas (id) on delete set null;

create index if not exists idx_recibos_derrama on public.recibos (derrama_id) where derrama_id is not null;

alter table public.derramas enable row level security;

drop policy if exists "derramas_lectura" on public.derramas;
create policy "derramas_lectura" on public.derramas
  for select to authenticated using (public.es_miembro(comunidad_id));

drop policy if exists "derramas_escritura" on public.derramas;
create policy "derramas_escritura" on public.derramas
  for all to authenticated using (public.puede_editar_finanzas(comunidad_id))
  with check (public.puede_editar_finanzas(comunidad_id));

grant select, insert, update, delete on public.derramas to authenticated;

-- ------------------------------------------------------------
-- Crear una derrama con todos sus recibos
-- ------------------------------------------------------------
-- El importe se divide entre los plazos (los centimos que sobran van a los
-- primeros) y cada plazo se reparte por coeficiente con generar_recibos.
create or replace function public.crear_derrama(
  p_comunidad_id uuid,
  p_titulo text,
  p_descripcion text,
  p_importe_total numeric,
  p_plazos integer,
  p_primer_vencimiento date,
  p_meses_entre_plazos integer default 1,
  p_punto_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_titulo text := trim(p_titulo);
  v_total bigint := round(p_importe_total * 100);
  v_base bigint;
  v_resto bigint;
  v_vence date;
  v_concepto text;
  i integer;
begin
  if not public.puede_editar_finanzas(p_comunidad_id) then
    raise exception 'Sin permiso para crear derramas' using errcode = '42501';
  end if;
  if p_plazos is null or p_plazos < 1 or p_plazos > 60 then
    raise exception 'El número de plazos debe estar entre 1 y 60' using errcode = '22023';
  end if;
  if p_punto_id is not null and not exists (
    select 1 from public.puntos_del_dia p join public.juntas j on j.id = p.junta_id
    where p.id = p_punto_id and j.comunidad_id = p_comunidad_id
  ) then
    raise exception 'El acuerdo no es de esta comunidad' using errcode = '22023';
  end if;
  if v_titulo is null or length(v_titulo) < 2 then
    raise exception 'Falta el título de la derrama' using errcode = '22023';
  end if;
  -- generar_recibos no repite un concepto en el mismo mes: con un titulo ya
  -- usado se quedarian plazos sin recibos.
  if exists (
    select 1 from public.recibos
     where comunidad_id = p_comunidad_id
       and (concepto = 'Derrama: ' || v_titulo or concepto like 'Derrama: ' || v_titulo || ' (%')
  ) then
    raise exception 'Ya hay recibos de una derrama con ese título; usa otro' using errcode = '23505';
  end if;

  insert into public.derramas (
    comunidad_id, titulo, descripcion, importe_total, plazos, primer_vencimiento,
    meses_entre_plazos, punto_id, creado_por
  ) values (
    p_comunidad_id, v_titulo, nullif(trim(p_descripcion), ''), round(p_importe_total, 2), p_plazos,
    p_primer_vencimiento, coalesce(p_meses_entre_plazos, 1), p_punto_id, auth.uid()
  )
  returning id into v_id;

  v_base := v_total / p_plazos;
  v_resto := v_total - v_base * p_plazos;

  for i in 1..p_plazos loop
    v_vence := (p_primer_vencimiento + make_interval(months => (i - 1) * coalesce(p_meses_entre_plazos, 1)))::date;
    v_concepto := 'Derrama: ' || v_titulo
      || case when p_plazos > 1 then ' (' || i || '/' || p_plazos || ')' else '' end;
    perform public.generar_recibos(
      p_comunidad_id,
      v_vence,
      v_concepto,
      (v_base + case when i <= v_resto then 1 else 0 end) / 100.0,
      v_vence
    );
    update public.recibos
       set derrama_id = v_id
     where comunidad_id = p_comunidad_id
       and concepto = v_concepto
       and periodo = date_trunc('month', v_vence)::date
       and derrama_id is null;
  end loop;

  return v_id;
end;
$$;

revoke all on function public.crear_derrama(uuid, text, text, numeric, integer, date, integer, uuid) from public, anon;
grant execute on function public.crear_derrama(uuid, text, text, numeric, integer, date, integer, uuid) to authenticated;

-- ------------------------------------------------------------
-- Anular una derrama: se anulan los recibos que no tienen cobros
-- ------------------------------------------------------------
create or replace function public.anular_derrama(p_derrama_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_comunidad uuid;
  v_anulados integer;
begin
  select comunidad_id into v_comunidad from public.derramas where id = p_derrama_id and anulada_en is null;
  if v_comunidad is null or not public.puede_editar_finanzas(v_comunidad) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;

  update public.recibos r
     set estado = 'anulado'
   where r.derrama_id = p_derrama_id
     and r.estado in ('pendiente', 'devuelto', 'aplazado')
     and not exists (select 1 from public.pagos p where p.recibo_id = r.id);
  get diagnostics v_anulados = row_count;

  update public.derramas set anulada_en = now() where id = p_derrama_id;
  return v_anulados;
end;
$$;

revoke all on function public.anular_derrama(uuid) from public, anon;
grant execute on function public.anular_derrama(uuid) to authenticated;
