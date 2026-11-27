-- ============================================================
-- Morosos en las juntas (art. 15.2 y 16.2 LPH)
-- ============================================================
-- Los propietarios que, en la fecha de la junta, no esten al corriente de
-- las deudas vencidas con la comunidad pueden asistir y hablar, pero no
-- votar, y la convocatoria debe incluir su relacion.
--
-- morosos_junta devuelve las fincas con deuda vencida antes del dia de la
-- junta, contando solo los cobros registrados hasta ese dia. Asi la lista de
-- una junta pasada no cambia aunque el vecino pague despues.
--   - Cuenta los recibos pendientes, devueltos y los pagados despues de la
--     junta. Los aplazados (acuerdo de pago) y los anulados no.
--   - Un recibo vence en su fecha de vencimiento o, si no tiene, a fin de mes.
-- La relacion de morosos forma parte de la convocatoria, asi que la puede
-- leer cualquier miembro de la comunidad, aunque no vea los recibos ajenos.

create or replace function public.morosos_junta(p_junta_id uuid)
returns table (finca_id uuid, codigo text, deuda numeric, desde date)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with junta as (
    select j.id, j.comunidad_id, (j.fecha_hora at time zone 'Europe/Madrid')::date as dia
      from public.juntas j
     where j.id = p_junta_id
       and public.es_miembro(j.comunidad_id)
  ),
  vencidos as (
    select r.finca_id,
           r.periodo,
           r.importe - coalesce((
             select sum(p.importe)
               from public.pagos p
              where p.recibo_id = r.id
                and p.fecha <= junta.dia
           ), 0) as pendiente
      from public.recibos r
      join junta on junta.comunidad_id = r.comunidad_id
     where r.estado in ('pendiente', 'devuelto', 'pagado')
       and coalesce(
             r.vence_en,
             (date_trunc('month', r.periodo) + interval '1 month - 1 day')::date
           ) < junta.dia
  )
  select f.id, f.codigo, sum(v.pendiente)::numeric(12,2), min(v.periodo)
    from vencidos v
    join public.fincas f on f.id = v.finca_id
   where v.pendiente > 0
   group by f.id, f.codigo, f.tipo, f.numero
   order by f.tipo, f.numero, f.codigo;
$$;

revoke all on function public.morosos_junta(uuid) from public;
grant execute on function public.morosos_junta(uuid) to authenticated;
