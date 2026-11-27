-- Avisos a los vecinos (punto 7 del informe de administrador de fincas).
--
-- La tabla notificaciones pasa a ser la bandeja de avisos de cada persona y,
-- a la vez, la cola de correos: un aviso con correo_enviado_en vacio esta
-- pendiente de enviarse por correo. Los avisos se crean con disparadores,
-- asi que nacen igual sea cual sea la pantalla que provoca el cambio.

-- ------------------------------------------------------------
-- Datos de contacto para notificaciones (art. 9.1.h LPH)
-- ------------------------------------------------------------
alter table public.perfiles
  add column if not exists domicilio_notificaciones text,
  add column if not exists avisos_correo boolean not null default true;

-- ------------------------------------------------------------
-- Cola de correos
-- ------------------------------------------------------------
alter table public.notificaciones
  add column if not exists correo_enviado_en timestamptz,
  add column if not exists correo_error text;

create index if not exists idx_notificaciones_correo_pendiente
  on public.notificaciones (creado_en)
  where correo_enviado_en is null and correo_error is null;

-- ------------------------------------------------------------
-- Quien ha leido cada anuncio: lo ve tambien la junta directiva
-- ------------------------------------------------------------
drop policy if exists "lecturas_junta" on public.lecturas_anuncio;
create policy "lecturas_junta" on public.lecturas_anuncio
  for select to authenticated using (
    exists (
      select 1 from public.anuncios a
      where a.id = anuncio_id and public.es_administrador(a.comunidad_id)
    )
  );

-- ------------------------------------------------------------
-- Crear avisos para una lista de personas
-- ------------------------------------------------------------
create or replace function public.crear_avisos(
  p_comunidad_id uuid,
  p_usuarios uuid[],
  p_tipo text,
  p_titulo text,
  p_cuerpo text,
  p_url text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notificaciones (usuario_id, comunidad_id, tipo, titulo, cuerpo, url)
  select distinct u, p_comunidad_id, p_tipo, p_titulo, p_cuerpo, p_url
  from unnest(p_usuarios) as u
  where u is not null and u is distinct from auth.uid();
$$;

revoke all on function public.crear_avisos(uuid, uuid[], text, text, text, text) from public, anon, authenticated;

-- Miembros activos de una comunidad.
create or replace function public.miembros_activos(p_comunidad_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(usuario_id), '{}')
  from public.miembros
  where comunidad_id = p_comunidad_id and estado = 'activo';
$$;

revoke all on function public.miembros_activos(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Anuncio nuevo en el tablon: aviso a todos
-- ------------------------------------------------------------
create or replace function public.tr_avisar_anuncio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.crear_avisos(
    new.comunidad_id,
    public.miembros_activos(new.comunidad_id),
    'anuncio',
    new.titulo,
    'Nuevo aviso en el tablón.',
    '/tablon#anuncio-' || new.id
  );
  return new;
end;
$$;

drop trigger if exists tr_avisar_anuncio on public.anuncios;
create trigger tr_avisar_anuncio
  after insert on public.anuncios
  for each row execute function public.tr_avisar_anuncio();

-- ------------------------------------------------------------
-- Incidencias: aviso a quien la abrio cuando cambia o se comenta
-- ------------------------------------------------------------
create or replace function public.tr_avisar_seguimiento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_incidencia record;
  v_estado text;
begin
  select id, comunidad_id, titulo, reportado_por into v_incidencia
  from public.incidencias where id = new.incidencia_id;
  if not found or v_incidencia.reportado_por is null then
    return new;
  end if;

  v_estado := case new.estado_nuevo::text
    when 'abierta' then 'abierta'
    when 'en_curso' then 'en curso'
    when 'resuelta' then 'resuelta'
    when 'cerrada' then 'cerrada'
    else null
  end;

  perform public.crear_avisos(
    v_incidencia.comunidad_id,
    array[v_incidencia.reportado_por],
    'incidencia',
    'Incidencia: ' || v_incidencia.titulo,
    concat_ws(' ',
      case when v_estado is not null then 'Estado: ' || v_estado || '.' end,
      case when nullif(btrim(new.texto), '') is not null then '«' || left(btrim(new.texto), 200) || '»' end
    ),
    '/incidencias#incidencia-' || v_incidencia.id
  );
  return new;
end;
$$;

drop trigger if exists tr_avisar_seguimiento on public.seguimientos_incidencia;
create trigger tr_avisar_seguimiento
  after insert on public.seguimientos_incidencia
  for each row execute function public.tr_avisar_seguimiento();

-- ------------------------------------------------------------
-- Recibos nuevos: aviso a los titulares de la vivienda
-- ------------------------------------------------------------
create or replace function public.tr_avisar_recibo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_titulares uuid[];
begin
  select f.codigo into v_codigo from public.fincas f where f.id = new.finca_id;

  select coalesce(array_agg(t.usuario_id), '{}') into v_titulares
  from public.titulares t
  where t.finca_id = new.finca_id and (t.hasta is null or t.hasta >= current_date);

  perform public.crear_avisos(
    new.comunidad_id,
    v_titulares,
    'recibo',
    'Recibo nuevo · ' || coalesce(v_codigo, 'tu vivienda'),
    new.concepto || ': ' || replace(to_char(new.importe, 'FM999999990.00'), '.', ',') || ' €'
      || case when new.vence_en is not null then ', vence el ' || to_char(new.vence_en, 'DD/MM/YYYY') else '' end
      || '.',
    '/finanzas/recibos'
  );
  return new;
end;
$$;

drop trigger if exists tr_avisar_recibo on public.recibos;
create trigger tr_avisar_recibo
  after insert on public.recibos
  for each row execute function public.tr_avisar_recibo();

-- ------------------------------------------------------------
-- Juntas: convocatoria enviada y acta publicada
-- ------------------------------------------------------------
create or replace function public.tr_avisar_junta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- La convocatoria ya avisa por si misma: se quita el aviso duplicado del
  -- anuncio del tablon que la acompana.
  if new.convocatoria_anuncio_id is not null
     and new.convocatoria_anuncio_id is distinct from old.convocatoria_anuncio_id
     and old.convocatoria_enviada_en is null then
    delete from public.notificaciones
    where url = '/tablon#anuncio-' || new.convocatoria_anuncio_id;
  end if;

  if old.convocatoria_enviada_en is null and new.convocatoria_enviada_en is not null then
    perform public.crear_avisos(
      new.comunidad_id,
      public.miembros_activos(new.comunidad_id),
      'convocatoria',
      'Convocatoria: ' || new.titulo,
      'Junta ' || new.tipo::text || ' el '
        || to_char(new.fecha_hora at time zone 'Europe/Madrid', 'DD/MM/YYYY "a las" HH24:MI') || '.',
      '/juntas/' || new.id || '/convocatoria'
    );
  end if;

  if old.acta_documento_id is null and new.acta_documento_id is not null then
    perform public.crear_avisos(
      new.comunidad_id,
      public.miembros_activos(new.comunidad_id),
      'acta',
      'Acta disponible: ' || new.titulo,
      'Ya puedes leer el acta de la junta.',
      '/juntas/' || new.id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists tr_avisar_junta on public.juntas;
create trigger tr_avisar_junta
  after update on public.juntas
  for each row execute function public.tr_avisar_junta();
