-- Datos iniciales de la comunidad.
-- Idempotente: solo actua si todavia no existe ninguna comunidad.

do $$
declare
  v_comunidad uuid;
begin
  if exists (select 1 from public.comunidades) then
    return;
  end if;

  insert into public.comunidades (nombre, coeficiente_total)
  values ('Mi Comunidad', 100)
  returning id into v_comunidad;

  insert into public.categorias_gasto (comunidad_id, nombre, tipo) values
    (v_comunidad, 'Ascensor', 'gasto'),
    (v_comunidad, 'Limpieza', 'gasto'),
    (v_comunidad, 'Electricidad', 'gasto'),
    (v_comunidad, 'Agua', 'gasto'),
    (v_comunidad, 'Seguros', 'gasto'),
    (v_comunidad, 'Mantenimiento', 'gasto'),
    (v_comunidad, 'Jardín y piscina', 'gasto'),
    (v_comunidad, 'Administración', 'gasto'),
    (v_comunidad, 'Obras y reparaciones', 'gasto'),
    (v_comunidad, 'Otros gastos', 'gasto'),
    (v_comunidad, 'Cuotas de vecinos', 'ingreso'),
    (v_comunidad, 'Otros ingresos', 'ingreso');

  insert into public.zonas_comunes (comunidad_id, nombre, descripcion, requiere_aprobacion) values
    (v_comunidad, 'Salón comunitario', 'Salón para reuniones y celebraciones', true),
    (v_comunidad, 'Pista deportiva', 'Pista polideportiva', false),
    (v_comunidad, 'Barbacoa', 'Zona de barbacoa', true);
end;
$$;
