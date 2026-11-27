-- Votaciones que calculan el resultado (punto 8 del informe de administrador
-- de fincas).
--
-- Cada vivienda vota en la tabla votos (a favor, en contra, abstencion). El
-- resultado se calcula en la app segun la mayoria del punto (art. 17 LPH).
-- Los propietarios ausentes pueden comunicar su postura despues de la junta
-- (art. 17.8): esas respuestas son votos con ausente = true.

-- Mayoria de tres quintos (art. 17.3 LPH).
alter type public.mayoria_requerida add value if not exists 'tres_quintos' after 'doble';

-- Respuesta de un propietario ausente, recibida despues de la junta.
alter table public.votos
  add column if not exists ausente boolean not null default false;

-- Fecha en que se notifico el acta: desde ella corren los 30 dias naturales
-- de los ausentes (art. 17.8) y los plazos de impugnacion (art. 18.3).
alter table public.juntas
  add column if not exists acta_notificada_en date;

-- Si ya hay actas publicadas, la fecha de notificacion es la de su subida.
update public.juntas j
set acta_notificada_en = (d.creado_en at time zone 'Europe/Madrid')::date
from public.documentos d
where d.id = j.acta_documento_id and j.acta_notificada_en is null;

-- El coeficiente del voto es el de la vivienda, y la vivienda tiene que ser
-- de la comunidad de la junta.
create or replace function public.preparar_voto()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_coeficiente numeric(8,4);
begin
  select f.coeficiente
    into v_coeficiente
    from public.puntos_del_dia p
    join public.juntas j on j.id = p.junta_id
    join public.fincas f on f.comunidad_id = j.comunidad_id
   where p.id = new.punto_id
     and f.id = new.finca_id;

  if not found then
    raise exception 'La vivienda no pertenece a la comunidad de la junta';
  end if;

  new.coeficiente = v_coeficiente;
  return new;
end;
$$;

drop trigger if exists tr_votos_preparar on public.votos;
create trigger tr_votos_preparar
  before insert or update of finca_id, punto_id on public.votos
  for each row execute function public.preparar_voto();
