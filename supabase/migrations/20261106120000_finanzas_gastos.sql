-- ============================================================
-- Finanzas: cuota mensual y edicion limitada a presidente
-- ============================================================
-- La cuota mensual es el total que paga el conjunto de vecinos cada mes.
-- Se guarda en la comunidad para poder mostrarla de forma informativa.

alter table public.comunidades
  add column if not exists cuota_mensual numeric(12,2) not null default 0
    check (cuota_mensual >= 0);

-- ------------------------------------------------------------
-- Permiso de edicion de finanzas
-- ------------------------------------------------------------
-- Solo el presidente de la comunidad y el administrador de plataforma
-- pueden registrar gastos, editar la cuota y mantener presupuestos,
-- proveedores, categorias, recibos y pagos.

create or replace function public.puede_editar_finanzas(p_comunidad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.es_admin_plataforma()
      or public.tiene_rol(
        p_comunidad_id,
        array['presidente']::public.rol_miembro[]
      );
$$;

revoke all on function public.puede_editar_finanzas(uuid) from public;
grant execute on function public.puede_editar_finanzas(uuid) to authenticated;

-- ------------------------------------------------------------
-- Politicas de escritura de la parte economica
-- ------------------------------------------------------------
drop policy if exists "categorias_escritura" on public.categorias_gasto;
create policy "categorias_escritura" on public.categorias_gasto
  for all to authenticated
  using (public.puede_editar_finanzas(comunidad_id))
  with check (public.puede_editar_finanzas(comunidad_id));

drop policy if exists "proveedores_escritura" on public.proveedores;
create policy "proveedores_escritura" on public.proveedores
  for all to authenticated
  using (public.puede_editar_finanzas(comunidad_id))
  with check (public.puede_editar_finanzas(comunidad_id));

drop policy if exists "presupuestos_escritura" on public.presupuestos;
create policy "presupuestos_escritura" on public.presupuestos
  for all to authenticated
  using (public.puede_editar_finanzas(comunidad_id))
  with check (public.puede_editar_finanzas(comunidad_id));

drop policy if exists "partidas_escritura" on public.partidas_presupuesto;
create policy "partidas_escritura" on public.partidas_presupuesto
  for all to authenticated
  using (
    exists (
      select 1 from public.presupuestos p
      where p.id = presupuesto_id
        and public.puede_editar_finanzas(p.comunidad_id)
    )
  )
  with check (
    exists (
      select 1 from public.presupuestos p
      where p.id = presupuesto_id
        and public.puede_editar_finanzas(p.comunidad_id)
    )
  );

drop policy if exists "gastos_escritura" on public.gastos;
create policy "gastos_escritura" on public.gastos
  for all to authenticated
  using (public.puede_editar_finanzas(comunidad_id))
  with check (public.puede_editar_finanzas(comunidad_id));

drop policy if exists "recibos_escritura" on public.recibos;
create policy "recibos_escritura" on public.recibos
  for all to authenticated
  using (public.puede_editar_finanzas(comunidad_id))
  with check (public.puede_editar_finanzas(comunidad_id));

drop policy if exists "pagos_escritura" on public.pagos;
create policy "pagos_escritura" on public.pagos
  for all to authenticated
  using (
    exists (
      select 1 from public.recibos r
      where r.id = recibo_id
        and public.puede_editar_finanzas(r.comunidad_id)
    )
  )
  with check (
    exists (
      select 1 from public.recibos r
      where r.id = recibo_id
        and public.puede_editar_finanzas(r.comunidad_id)
    )
  );
