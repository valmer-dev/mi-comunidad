-- ============================================================
-- Protección de datos
-- ============================================================
--
-- 1. Nadie puede darse a si mismo el acceso de administrador de plataforma.
-- 2. Se guarda cuando cada persona ha visto la informacion de privacidad.
-- 3. La lista de morosos solo muestra importes a la junta, y a los vecinos
--    solo cuando la junta ya esta convocada (art. 16.2 LPH).
-- 4. Borrar a una persona no borra su asistencia de las actas pasadas.

-- ------------------------------------------------------------
-- 1. es_admin_plataforma solo lo cambia otro administrador
-- ------------------------------------------------------------
-- La politica perfiles_edicion_propia deja a cada usuario editar su fila,
-- incluida esta columna. El servidor con la clave de servicio (sin
-- auth.uid()) y los administradores de plataforma pueden seguir cambiandola.
create or replace function public.proteger_perfil()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.es_admin_plataforma() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.es_admin_plataforma := false;
    return new;
  end if;

  if new.es_admin_plataforma is distinct from old.es_admin_plataforma then
    raise exception 'No puedes cambiar el acceso de administrador de plataforma'
      using errcode = '42501';
  end if;
  if new.id is distinct from old.id then
    raise exception 'No se puede cambiar el identificador del perfil'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_perfiles_proteger on public.perfiles;
create trigger tr_perfiles_proteger
  before insert or update on public.perfiles
  for each row execute function public.proteger_perfil();

-- ------------------------------------------------------------
-- 2. Informacion de privacidad vista
-- ------------------------------------------------------------
alter table public.perfiles
  add column if not exists privacidad_vista_en timestamptz;

-- ------------------------------------------------------------
-- 3. Morosos: importes solo para la junta
-- ------------------------------------------------------------
create or replace function public.morosos_junta(p_junta_id uuid)
returns table (finca_id uuid, codigo text, deuda numeric, desde date)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with junta as (
    select j.id,
           j.comunidad_id,
           (j.fecha_hora at time zone 'Europe/Madrid')::date as dia,
           (public.es_administrador(j.comunidad_id)
             or public.puede_editar_finanzas(j.comunidad_id)) as es_junta
      from public.juntas j
     where j.id = p_junta_id
       and public.es_miembro(j.comunidad_id)
  ),
  visible as (
    -- Un vecino solo ve la relacion cuando ya forma parte de la convocatoria.
    select junta.*
      from junta
      join public.juntas j on j.id = junta.id
     where junta.es_junta or j.estado <> 'borrador'
  ),
  vencidos as (
    select r.finca_id,
           r.periodo,
           r.importe - coalesce((
             select sum(p.importe)
               from public.pagos p
              where p.recibo_id = r.id
                and p.fecha <= visible.dia
           ), 0) as pendiente
      from public.recibos r
      join visible on visible.comunidad_id = r.comunidad_id
     where r.estado in ('pendiente', 'devuelto', 'pagado')
       and coalesce(
             r.vence_en,
             (date_trunc('month', r.periodo) + interval '1 month - 1 day')::date
           ) < visible.dia
  )
  select f.id,
         f.codigo,
         case when (select es_junta from visible) then sum(v.pendiente)::numeric(12,2) end,
         case when (select es_junta from visible) then min(v.periodo) end
    from vencidos v
    join public.fincas f on f.id = v.finca_id
   where v.pendiente > 0
   group by f.id, f.codigo, f.tipo, f.numero
   order by f.tipo, f.numero, f.codigo;
$$;

revoke all on function public.morosos_junta(uuid) from public;
grant execute on function public.morosos_junta(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. Las actas conservan la asistencia aunque se borre a la persona
-- ------------------------------------------------------------
alter table public.asistencias
  drop constraint if exists asistencias_usuario_id_fkey;
alter table public.asistencias
  add constraint asistencias_usuario_id_fkey
  foreign key (usuario_id) references public.perfiles (id) on delete set null;
