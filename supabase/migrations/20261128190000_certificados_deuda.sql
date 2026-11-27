-- Certificados de deuda (punto 14 del informe de administrador de fincas).
--
-- Al vender una vivienda, el vendedor tiene que declarar en la escritura que
-- esta al corriente con la comunidad o aportar un certificado de lo que debe,
-- que expide el secretario con el visto bueno del presidente en 7 dias
-- naturales desde que se pide (art. 9.1.e LPH). Se guarda cada certificado,
-- numerado, con la foto de la deuda en el momento de emitirlo.

create table if not exists public.certificados_deuda (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  finca_id uuid not null references public.fincas (id) on delete cascade,
  numero integer,
  solicitante text not null check (length(trim(solicitante)) between 2 and 160),
  motivo text not null default 'compraventa' check (motivo in ('compraventa', 'otro')),
  solicitado_en date not null default ((now() at time zone 'Europe/Madrid')::date),
  emitido_en date,
  deuda_total numeric(12,2),
  deuda_vencida numeric(12,2),
  -- Parte de la que responde la vivienda: anualidad en curso y tres anteriores
  deuda_afecta numeric(12,2),
  detalle jsonb not null default '[]'::jsonb,
  creado_por uuid references public.perfiles (id) on delete set null default auth.uid(),
  creado_en timestamptz not null default now(),
  unique (comunidad_id, numero),
  check (emitido_en is null or (deuda_total is not null and deuda_total >= 0))
);

create index if not exists idx_certificados_deuda_finca on public.certificados_deuda (finca_id, creado_en desc);

alter table public.certificados_deuda enable row level security;

-- Los ve la junta y el titular de la vivienda.
drop policy if exists "certificados_deuda_lectura" on public.certificados_deuda;
create policy "certificados_deuda_lectura" on public.certificados_deuda
  for select to authenticated
  using (
    public.es_administrador(comunidad_id)
    or public.puede_ver_finanzas(comunidad_id)
    or exists (
      select 1 from public.titulares t
       where t.finca_id = certificados_deuda.finca_id
         and t.usuario_id = auth.uid()
         and t.hasta is null
    )
  );

drop policy if exists "certificados_deuda_escritura" on public.certificados_deuda;
create policy "certificados_deuda_escritura" on public.certificados_deuda
  for all to authenticated
  using (public.es_administrador(comunidad_id) or public.puede_editar_finanzas(comunidad_id))
  with check (public.es_administrador(comunidad_id) or public.puede_editar_finanzas(comunidad_id));

grant select, insert, update, delete on public.certificados_deuda to authenticated;

-- Numero correlativo por comunidad al emitirlo, y la vivienda debe ser de la
-- comunidad. Un certificado emitido ya no cambia.
create or replace function public.preparar_certificado_deuda()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.fincas where id = new.finca_id and comunidad_id = new.comunidad_id) then
    raise exception 'La vivienda no es de esta comunidad' using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' and old.emitido_en is not null then
    raise exception 'Un certificado emitido no se puede modificar' using errcode = '22023';
  end if;

  if new.emitido_en is not null and new.numero is null then
    perform pg_advisory_xact_lock(hashtext('certificados_deuda:' || new.comunidad_id::text));
    select coalesce(max(numero), 0) + 1 into new.numero
      from public.certificados_deuda where comunidad_id = new.comunidad_id;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_preparar_certificado_deuda on public.certificados_deuda;
create trigger tr_preparar_certificado_deuda
  before insert or update on public.certificados_deuda
  for each row execute function public.preparar_certificado_deuda();

-- Un certificado emitido tampoco se borra: queda como constancia. Solo se va
-- si se borra la vivienda o la comunidad entera (borrado en cascada).
create or replace function public.proteger_certificado_deuda()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.emitido_en is not null and exists (select 1 from public.fincas where id = old.finca_id) then
    raise exception 'Un certificado emitido no se puede borrar' using errcode = '22023';
  end if;
  return old;
end;
$$;

drop trigger if exists tr_proteger_certificado_deuda on public.certificados_deuda;
create trigger tr_proteger_certificado_deuda
  before delete on public.certificados_deuda
  for each row execute function public.proteger_certificado_deuda();
