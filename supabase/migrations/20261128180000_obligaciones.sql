-- Calendario de obligaciones (punto 13 del informe de administrador de fincas).
--
-- Obligaciones periodicas de la comunidad que no salen de otros datos de la
-- app: inspecciones (ITE/IEE, ascensor, baja tension), revisiones (extintores,
-- gas), impuestos (modelo 347), renovacion del seguro... Cada una tiene una
-- fecha y, si se repite, cada cuantos meses. Al marcarla como hecha se pasa a
-- la siguiente fecha.

create table if not exists public.obligaciones (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  titulo text not null check (length(trim(titulo)) between 2 and 120),
  descripcion text check (descripcion is null or length(descripcion) <= 1000),
  categoria text not null default 'otra'
    check (categoria in ('inspeccion', 'mantenimiento', 'fiscal', 'seguro', 'junta', 'otra')),
  fecha date not null,
  cada_meses integer check (cada_meses is null or cada_meses between 1 and 240),
  aviso_dias integer not null default 30 check (aviso_dias between 0 and 365),
  proveedor_id uuid references public.proveedores (id) on delete set null,
  ultima_vez date,
  completada_en date,
  creado_por uuid references public.perfiles (id) on delete set null default auth.uid(),
  creado_en timestamptz not null default now()
);

create index if not exists idx_obligaciones_comunidad on public.obligaciones (comunidad_id, fecha)
  where completada_en is null;

alter table public.obligaciones enable row level security;

-- La ve la junta (quien administra la comunidad o ve las finanzas).
drop policy if exists "obligaciones_lectura" on public.obligaciones;
create policy "obligaciones_lectura" on public.obligaciones
  for select to authenticated
  using (public.es_administrador(comunidad_id) or public.puede_ver_finanzas(comunidad_id));

drop policy if exists "obligaciones_escritura" on public.obligaciones;
create policy "obligaciones_escritura" on public.obligaciones
  for all to authenticated
  using (public.es_administrador(comunidad_id) or public.puede_editar_finanzas(comunidad_id))
  with check (public.es_administrador(comunidad_id) or public.puede_editar_finanzas(comunidad_id));

grant select, insert, update, delete on public.obligaciones to authenticated;

create or replace function public.validar_obligacion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.proveedor_id is not null and not exists (
    select 1 from public.proveedores where id = new.proveedor_id and comunidad_id = new.comunidad_id
  ) then
    raise exception 'El proveedor no es de esta comunidad' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_validar_obligacion on public.obligaciones;
create trigger tr_validar_obligacion
  before insert or update of proveedor_id, comunidad_id on public.obligaciones
  for each row execute function public.validar_obligacion();

-- Marcar como hecha. Si no se repite, queda completada. Si se repite:
-- - impuestos, seguro y junta tienen fecha fija en el calendario: se suma el
--   periodo a la fecha prevista hasta pasar del dia en que se hizo;
-- - inspecciones y mantenimientos cuentan desde el dia en que se hicieron.
create or replace function public.completar_obligacion(p_id uuid, p_hecha_el date default null)
returns date
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_fila public.obligaciones;
  v_hecha date := coalesce(p_hecha_el, (now() at time zone 'Europe/Madrid')::date);
  v_siguiente date;
begin
  select * into v_fila from public.obligaciones where id = p_id for update;
  if v_fila.id is null then
    raise exception 'No se encontró la obligación' using errcode = '22023';
  end if;

  if v_fila.cada_meses is null then
    update public.obligaciones set ultima_vez = v_hecha, completada_en = v_hecha where id = p_id;
    return null;
  end if;

  if v_fila.categoria in ('fiscal', 'seguro', 'junta') then
    v_siguiente := v_fila.fecha;
    loop
      v_siguiente := (v_siguiente + make_interval(months => v_fila.cada_meses))::date;
      exit when v_siguiente > v_hecha;
    end loop;
  else
    v_siguiente := (v_hecha + make_interval(months => v_fila.cada_meses))::date;
  end if;

  update public.obligaciones set ultima_vez = v_hecha, fecha = v_siguiente where id = p_id;
  return v_siguiente;
end;
$$;

revoke all on function public.completar_obligacion(uuid, date) from public, anon;
grant execute on function public.completar_obligacion(uuid, date) to authenticated;
