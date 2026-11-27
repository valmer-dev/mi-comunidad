-- Acta completa, notificada y con plazos (punto 9 del informe de
-- administrador de fincas).

alter table public.juntas
  -- En que convocatoria se celebro la junta (art. 19.2.c LPH).
  add column if not exists convocatoria_celebrada smallint
    check (convocatoria_celebrada in (1, 2)),
  -- Cierre y firma del acta por presidente y secretario: como maximo 10 dias
  -- naturales despues de la junta (art. 19.3).
  add column if not exists acta_firmada_en date;

-- El aviso del acta sale al notificarla (acta_notificada_en), sea con un PDF
-- subido o con el acta generada por la app.
create or replace function public.tr_avisar_junta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

  if old.acta_notificada_en is null and new.acta_notificada_en is not null then
    perform public.crear_avisos(
      new.comunidad_id,
      public.miembros_activos(new.comunidad_id),
      'acta',
      'Acta de la junta: ' || new.titulo,
      'Ya puedes leer el acta. Desde hoy corren los plazos para los ausentes y para impugnar acuerdos.',
      '/juntas/' || new.id || '/acta'
    );
  end if;

  return new;
end;
$$;
