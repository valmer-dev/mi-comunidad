-- ============================================================
-- Mi Comunidad - Esquema inicial
-- Convencion: nombres en espanol, snake_case, sin tildes ni enie.
-- Dinero: numeric(12,2). Coeficientes: numeric(8,4).
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tipos
-- ------------------------------------------------------------
create type public.rol_miembro as enum (
  'presidente',
  'vicepresidente',
  'secretario',
  'vocal',
  'propietario',
  'inquilino',
  'administrador_fincas'
);

create type public.estado_miembro as enum ('invitado', 'activo', 'inactivo');

create type public.tipo_finca as enum ('vivienda', 'local', 'garaje', 'trastero', 'otro');

create type public.tipo_titular as enum ('propietario', 'inquilino', 'familiar');

create type public.estado_recibo as enum ('pendiente', 'pagado', 'devuelto', 'aplazado', 'anulado');

create type public.tipo_movimiento as enum ('ingreso', 'gasto');

create type public.estado_presupuesto as enum ('borrador', 'aprobado', 'cerrado');

create type public.tipo_incidencia as enum (
  'fontaneria', 'electricidad', 'ascensor', 'limpieza', 'obra', 'ruido', 'zonas_comunes', 'otro'
);

create type public.estado_incidencia as enum ('abierta', 'en_curso', 'resuelta', 'cerrada');

create type public.prioridad_incidencia as enum ('baja', 'media', 'alta', 'urgente');

create type public.tipo_junta as enum ('ordinaria', 'extraordinaria');

create type public.estado_junta as enum ('borrador', 'convocada', 'celebrada', 'cerrada');

create type public.tipo_punto as enum ('informativo', 'acuerdo', 'votacion');

create type public.mayoria_requerida as enum ('simple', 'doble', 'unanimidad');

create type public.modo_asistencia as enum ('presencial', 'representado', 'ausente');

create type public.sentido_voto as enum ('favor', 'contra', 'abstencion');

create type public.estado_acuerdo as enum ('vigente', 'cumplido', 'archivado');

create type public.estado_reserva as enum ('pendiente', 'aprobada', 'rechazada', 'cancelada');

-- ------------------------------------------------------------
-- Comunidad
-- ------------------------------------------------------------
create table public.comunidades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text,
  codigo_postal text,
  ciudad text,
  provincia text,
  cif text,
  anio_construccion integer,
  iban text,
  coeficiente_total numeric(8,4) not null default 100 check (coeficiente_total > 0),
  administrador_nombre text,
  administrador_telefono text,
  administrador_correo text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Personas
-- ------------------------------------------------------------
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '',
  apellidos text,
  correo text,
  telefono text,
  avatar_url text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Fincas y titularidades
-- ------------------------------------------------------------
create table public.fincas (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  codigo text not null,
  tipo public.tipo_finca not null default 'vivienda',
  planta text,
  puerta text,
  metros_cuadrados numeric(8,2),
  coeficiente numeric(8,4) not null default 0 check (coeficiente >= 0),
  notas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (comunidad_id, codigo)
);

create table public.miembros (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  rol public.rol_miembro not null default 'propietario',
  estado public.estado_miembro not null default 'activo',
  finca_principal_id uuid references public.fincas (id) on delete set null,
  creado_en timestamptz not null default now(),
  unique (comunidad_id, usuario_id)
);

create table public.titulares (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  tipo public.tipo_titular not null default 'propietario',
  porcentaje numeric(5,2) not null default 100 check (porcentaje > 0 and porcentaje <= 100),
  desde date not null default current_date,
  hasta date,
  creado_en timestamptz not null default now(),
  unique (finca_id, usuario_id, desde)
);

create table public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  correo text not null,
  rol public.rol_miembro not null default 'propietario',
  finca_id uuid references public.fincas (id) on delete set null,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  caduca_en timestamptz not null default now() + interval '14 days',
  aceptada_en timestamptz,
  creada_por uuid references public.perfiles (id) on delete set null,
  creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Finanzas
-- ------------------------------------------------------------
create table public.categorias_gasto (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  nombre text not null,
  tipo public.tipo_movimiento not null default 'gasto',
  unique (comunidad_id, nombre)
);

create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  nombre text not null,
  cif text,
  categoria text,
  telefono text,
  correo text,
  persona_contacto text,
  contrato_inicio date,
  contrato_fin date,
  seguro_hasta date,
  notas text,
  creado_en timestamptz not null default now()
);

create table public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  ejercicio integer not null check (ejercicio between 2000 and 2100),
  estado public.estado_presupuesto not null default 'borrador',
  total_ingresos numeric(12,2) not null default 0,
  total_gastos numeric(12,2) not null default 0,
  aprobado_en timestamptz,
  notas text,
  creado_en timestamptz not null default now(),
  unique (comunidad_id, ejercicio)
);

create table public.partidas_presupuesto (
  id uuid primary key default gen_random_uuid(),
  presupuesto_id uuid not null references public.presupuestos (id) on delete cascade,
  categoria_id uuid references public.categorias_gasto (id) on delete set null,
  concepto text not null,
  tipo public.tipo_movimiento not null default 'gasto',
  importe numeric(12,2) not null check (importe >= 0),
  creado_en timestamptz not null default now()
);

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  fecha date not null default current_date,
  categoria_id uuid references public.categorias_gasto (id) on delete set null,
  proveedor_id uuid references public.proveedores (id) on delete set null,
  concepto text not null,
  base_imponible numeric(12,2) not null default 0,
  iva numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  pagado boolean not null default false,
  pagado_en date,
  factura_url text,
  creado_por uuid references public.perfiles (id) on delete set null,
  creado_en timestamptz not null default now()
);

create table public.recibos (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  finca_id uuid not null references public.fincas (id) on delete cascade,
  periodo date not null,
  concepto text not null default 'Cuota ordinaria',
  importe numeric(12,2) not null check (importe >= 0),
  estado public.estado_recibo not null default 'pendiente',
  vence_en date,
  pagado_en date,
  notas text,
  creado_en timestamptz not null default now(),
  unique (finca_id, periodo, concepto)
);

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  recibo_id uuid not null references public.recibos (id) on delete cascade,
  importe numeric(12,2) not null check (importe > 0),
  fecha date not null default current_date,
  metodo text,
  referencia text,
  registrado_por uuid references public.perfiles (id) on delete set null,
  creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Incidencias y mantenimiento
-- ------------------------------------------------------------
create table public.incidencias (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  titulo text not null,
  descripcion text,
  tipo public.tipo_incidencia not null default 'otro',
  prioridad public.prioridad_incidencia not null default 'media',
  estado public.estado_incidencia not null default 'abierta',
  ubicacion text,
  finca_id uuid references public.fincas (id) on delete set null,
  reportado_por uuid references public.perfiles (id) on delete set null,
  proveedor_id uuid references public.proveedores (id) on delete set null,
  coste numeric(12,2),
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz
);

create table public.seguimientos_incidencia (
  id uuid primary key default gen_random_uuid(),
  incidencia_id uuid not null references public.incidencias (id) on delete cascade,
  autor_id uuid references public.perfiles (id) on delete set null,
  texto text not null,
  estado_nuevo public.estado_incidencia,
  creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Documentacion y comunicacion
-- ------------------------------------------------------------
create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  nombre text not null,
  descripcion text,
  carpeta text not null default 'General',
  ruta_almacenamiento text,
  tipo_mime text,
  tamano_bytes bigint,
  visible_para public.rol_miembro[],
  caduca_en date,
  subido_por uuid references public.perfiles (id) on delete set null,
  creado_en timestamptz not null default now()
);

create table public.anuncios (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  titulo text not null,
  contenido text not null,
  fijado boolean not null default false,
  publicado_en timestamptz not null default now(),
  caduca_en date,
  autor_id uuid references public.perfiles (id) on delete set null,
  creado_en timestamptz not null default now()
);

create table public.lecturas_anuncio (
  anuncio_id uuid not null references public.anuncios (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  leido_en timestamptz not null default now(),
  primary key (anuncio_id, usuario_id)
);

-- ------------------------------------------------------------
-- Juntas
-- ------------------------------------------------------------
create table public.juntas (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  tipo public.tipo_junta not null default 'ordinaria',
  titulo text not null,
  fecha_hora timestamptz not null,
  lugar text,
  segunda_convocatoria_minutos integer not null default 30,
  estado public.estado_junta not null default 'borrador',
  acta_url text,
  notas text,
  creada_por uuid references public.perfiles (id) on delete set null,
  creado_en timestamptz not null default now()
);

create table public.puntos_del_dia (
  id uuid primary key default gen_random_uuid(),
  junta_id uuid not null references public.juntas (id) on delete cascade,
  posicion integer not null default 1,
  titulo text not null,
  descripcion text,
  tipo public.tipo_punto not null default 'informativo',
  mayoria_requerida public.mayoria_requerida not null default 'simple',
  resultado text,
  creado_en timestamptz not null default now()
);

create table public.asistencias (
  id uuid primary key default gen_random_uuid(),
  junta_id uuid not null references public.juntas (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  modo public.modo_asistencia not null default 'presencial',
  representado_por uuid references public.perfiles (id) on delete set null,
  coeficiente numeric(8,4) not null default 0,
  creado_en timestamptz not null default now(),
  unique (junta_id, usuario_id)
);

create table public.votos (
  id uuid primary key default gen_random_uuid(),
  punto_id uuid not null references public.puntos_del_dia (id) on delete cascade,
  finca_id uuid not null references public.fincas (id) on delete cascade,
  sentido public.sentido_voto not null,
  coeficiente numeric(8,4) not null default 0,
  emitido_por uuid references public.perfiles (id) on delete set null,
  creado_en timestamptz not null default now(),
  unique (punto_id, finca_id)
);

create table public.acuerdos (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  junta_id uuid references public.juntas (id) on delete set null,
  punto_id uuid references public.puntos_del_dia (id) on delete set null,
  texto text not null,
  estado public.estado_acuerdo not null default 'vigente',
  responsable_id uuid references public.perfiles (id) on delete set null,
  fecha_limite date,
  creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Zonas comunes y reservas
-- ------------------------------------------------------------
create table public.zonas_comunes (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  nombre text not null,
  descripcion text,
  normas text,
  requiere_aprobacion boolean not null default false,
  aforo integer,
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades (id) on delete cascade,
  zona_id uuid not null references public.zonas_comunes (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  finca_id uuid references public.fincas (id) on delete set null,
  inicio timestamptz not null,
  fin timestamptz not null,
  estado public.estado_reserva not null default 'pendiente',
  notas text,
  creado_en timestamptz not null default now(),
  check (fin > inicio)
);

-- ------------------------------------------------------------
-- Notificaciones y auditoria
-- ------------------------------------------------------------
create table public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  comunidad_id uuid references public.comunidades (id) on delete cascade,
  tipo text not null default 'general',
  titulo text not null,
  cuerpo text,
  url text,
  leida_en timestamptz,
  creado_en timestamptz not null default now()
);

create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid references public.comunidades (id) on delete cascade,
  usuario_id uuid references public.perfiles (id) on delete set null,
  accion text not null,
  entidad text not null,
  entidad_id uuid,
  datos jsonb,
  creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Indices
-- ------------------------------------------------------------
create index idx_miembros_usuario on public.miembros (usuario_id);
create index idx_miembros_comunidad on public.miembros (comunidad_id);
create index idx_fincas_comunidad on public.fincas (comunidad_id);
create index idx_titulares_finca on public.titulares (finca_id);
create index idx_titulares_usuario on public.titulares (usuario_id);
create index idx_recibos_comunidad on public.recibos (comunidad_id);
create index idx_recibos_finca on public.recibos (finca_id);
create index idx_recibos_estado on public.recibos (estado);
create index idx_gastos_comunidad on public.gastos (comunidad_id, fecha desc);
create index idx_incidencias_comunidad on public.incidencias (comunidad_id, estado);
create index idx_anuncios_comunidad on public.anuncios (comunidad_id, publicado_en desc);
create index idx_juntas_comunidad on public.juntas (comunidad_id, fecha_hora desc);
create index idx_reservas_zona on public.reservas (zona_id, inicio);
create index idx_notificaciones_usuario on public.notificaciones (usuario_id, leida_en);
create index idx_auditoria_comunidad on public.auditoria (comunidad_id, creado_en desc);

-- ------------------------------------------------------------
-- Triggers
-- ------------------------------------------------------------
create or replace function public.marcar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger tr_comunidades_actualizado
  before update on public.comunidades
  for each row execute function public.marcar_actualizado_en();

create trigger tr_perfiles_actualizado
  before update on public.perfiles
  for each row execute function public.marcar_actualizado_en();

create trigger tr_fincas_actualizado
  before update on public.fincas
  for each row execute function public.marcar_actualizado_en();

-- Crea el perfil automaticamente al dar de alta un usuario en Auth.
create or replace function public.crear_perfil_de_usuario()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.perfiles (id, nombre, correo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(coalesce(new.email, 'vecino'), '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger tr_auth_usuario_creado
  after insert on auth.users
  for each row execute function public.crear_perfil_de_usuario();

-- ------------------------------------------------------------
-- Funciones de permisos (security definer para evitar recursion en RLS)
-- ------------------------------------------------------------
create or replace function public.es_miembro(p_comunidad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.miembros m
    where m.comunidad_id = p_comunidad_id
      and m.usuario_id = auth.uid()
      and m.estado = 'activo'
  );
$$;

create or replace function public.tiene_rol(p_comunidad_id uuid, p_roles public.rol_miembro[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.miembros m
    where m.comunidad_id = p_comunidad_id
      and m.usuario_id = auth.uid()
      and m.estado = 'activo'
      and m.rol = any (p_roles)
  );
$$;

create or replace function public.es_administrador(p_comunidad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.tiene_rol(
    p_comunidad_id,
    array['presidente', 'vicepresidente', 'secretario']::public.rol_miembro[]
  );
$$;

create or replace function public.puede_ver_finanzas(p_comunidad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.tiene_rol(
    p_comunidad_id,
    array['presidente', 'vicepresidente', 'secretario', 'vocal', 'administrador_fincas']::public.rol_miembro[]
  );
$$;

create or replace function public.es_titular_de(p_finca_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.titulares t
    where t.finca_id = p_finca_id
      and t.usuario_id = auth.uid()
      and (t.hasta is null or t.hasta >= current_date)
  );
$$;

create or replace function public.comparte_comunidad(p_usuario_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.miembros a
    join public.miembros b on a.comunidad_id = b.comunidad_id
    where a.usuario_id = auth.uid()
      and b.usuario_id = p_usuario_id
  );
$$;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.comunidades enable row level security;
alter table public.perfiles enable row level security;
alter table public.fincas enable row level security;
alter table public.miembros enable row level security;
alter table public.titulares enable row level security;
alter table public.invitaciones enable row level security;
alter table public.categorias_gasto enable row level security;
alter table public.proveedores enable row level security;
alter table public.presupuestos enable row level security;
alter table public.partidas_presupuesto enable row level security;
alter table public.gastos enable row level security;
alter table public.recibos enable row level security;
alter table public.pagos enable row level security;
alter table public.incidencias enable row level security;
alter table public.seguimientos_incidencia enable row level security;
alter table public.documentos enable row level security;
alter table public.anuncios enable row level security;
alter table public.lecturas_anuncio enable row level security;
alter table public.juntas enable row level security;
alter table public.puntos_del_dia enable row level security;
alter table public.asistencias enable row level security;
alter table public.votos enable row level security;
alter table public.acuerdos enable row level security;
alter table public.zonas_comunes enable row level security;
alter table public.reservas enable row level security;
alter table public.notificaciones enable row level security;
alter table public.auditoria enable row level security;

-- Comunidades
create policy "comunidades_lectura" on public.comunidades
  for select to authenticated using (public.es_miembro(id));
create policy "comunidades_edicion" on public.comunidades
  for update to authenticated using (public.tiene_rol(id, array['presidente']::public.rol_miembro[]))
  with check (public.tiene_rol(id, array['presidente']::public.rol_miembro[]));

-- Perfiles
create policy "perfiles_lectura" on public.perfiles
  for select to authenticated using (id = auth.uid() or public.comparte_comunidad(id));
create policy "perfiles_edicion_propia" on public.perfiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Fincas
create policy "fincas_lectura" on public.fincas
  for select to authenticated using (public.es_miembro(comunidad_id));
create policy "fincas_escritura" on public.fincas
  for all to authenticated using (public.es_administrador(comunidad_id))
  with check (public.es_administrador(comunidad_id));

-- Miembros
create policy "miembros_lectura" on public.miembros
  for select to authenticated using (public.es_miembro(comunidad_id));
create policy "miembros_escritura" on public.miembros
  for all to authenticated using (public.es_administrador(comunidad_id))
  with check (public.es_administrador(comunidad_id));

-- Titulares
create policy "titulares_lectura" on public.titulares
  for select to authenticated using (
    public.es_miembro((select f.comunidad_id from public.fincas f where f.id = finca_id))
  );
create policy "titulares_escritura" on public.titulares
  for all to authenticated using (
    public.es_administrador((select f.comunidad_id from public.fincas f where f.id = finca_id))
  )
  with check (
    public.es_administrador((select f.comunidad_id from public.fincas f where f.id = finca_id))
  );

-- Invitaciones
create policy "invitaciones_admin" on public.invitaciones
  for all to authenticated using (public.es_administrador(comunidad_id))
  with check (public.es_administrador(comunidad_id));

-- Categorias
create policy "categorias_lectura" on public.categorias_gasto
  for select to authenticated using (public.es_miembro(comunidad_id));
create policy "categorias_escritura" on public.categorias_gasto
  for all to authenticated using (public.puede_ver_finanzas(comunidad_id))
  with check (public.puede_ver_finanzas(comunidad_id));

-- Proveedores
create policy "proveedores_lectura" on public.proveedores
  for select to authenticated using (public.es_miembro(comunidad_id));
create policy "proveedores_escritura" on public.proveedores
  for all to authenticated using (public.es_administrador(comunidad_id))
  with check (public.es_administrador(comunidad_id));

-- Presupuestos
create policy "presupuestos_lectura" on public.presupuestos
  for select to authenticated using (public.puede_ver_finanzas(comunidad_id));
create policy "presupuestos_escritura" on public.presupuestos
  for all to authenticated using (public.es_administrador(comunidad_id))
  with check (public.es_administrador(comunidad_id));

create policy "partidas_lectura" on public.partidas_presupuesto
  for select to authenticated using (
    exists (
      select 1 from public.presupuestos p
      where p.id = presupuesto_id and public.puede_ver_finanzas(p.comunidad_id)
    )
  );
create policy "partidas_escritura" on public.partidas_presupuesto
  for all to authenticated using (
    exists (
      select 1 from public.presupuestos p
      where p.id = presupuesto_id and public.es_administrador(p.comunidad_id)
    )
  )
  with check (
    exists (
      select 1 from public.presupuestos p
      where p.id = presupuesto_id and public.es_administrador(p.comunidad_id)
    )
  );

-- Gastos
create policy "gastos_lectura" on public.gastos
  for select to authenticated using (public.puede_ver_finanzas(comunidad_id));
create policy "gastos_escritura" on public.gastos
  for all to authenticated using (public.es_administrador(comunidad_id))
  with check (public.es_administrador(comunidad_id));

-- Recibos: finanzas ven todos; cada vecino ve los de sus fincas
create policy "recibos_lectura" on public.recibos
  for select to authenticated using (
    public.puede_ver_finanzas(comunidad_id) or public.es_titular_de(finca_id)
  );
create policy "recibos_escritura" on public.recibos
  for all to authenticated using (public.es_administrador(comunidad_id))
  with check (public.es_administrador(comunidad_id));

-- Pagos
create policy "pagos_lectura" on public.pagos
  for select to authenticated using (
    exists (
      select 1 from public.recibos r
      where r.id = recibo_id
        and (public.puede_ver_finanzas(r.comunidad_id) or public.es_titular_de(r.finca_id))
    )
  );
create policy "pagos_escritura" on public.pagos
  for all to authenticated using (
    exists (
      select 1 from public.recibos r
      where r.id = recibo_id and public.es_administrador(r.comunidad_id)
    )
  )
  with check (
    exists (
      select 1 from public.recibos r
      where r.id = recibo_id and public.es_administrador(r.comunidad_id)
    )
  );

-- Incidencias
create policy "incidencias_lectura" on public.incidencias
  for select to authenticated using (public.es_miembro(comunidad_id));
create policy "incidencias_crear" on public.incidencias
  for insert to authenticated with check (
    public.es_miembro(comunidad_id) and reportado_por = auth.uid()
  );
create policy "incidencias_edicion" on public.incidencias
  for update to authenticated using (
    public.es_administrador(comunidad_id) or reportado_por = auth.uid()
  )
  with check (
    public.es_administrador(comunidad_id) or reportado_por = auth.uid()
  );
create policy "incidencias_borrado" on public.incidencias
  for delete to authenticated using (public.es_administrador(comunidad_id));

create policy "seguimientos_lectura" on public.seguimientos_incidencia
  for select to authenticated using (
    exists (
      select 1 from public.incidencias i
      where i.id = incidencia_id and public.es_miembro(i.comunidad_id)
    )
  );
create policy "seguimientos_crear" on public.seguimientos_incidencia
  for insert to authenticated with check (
    autor_id = auth.uid()
    and exists (
      select 1 from public.incidencias i
      where i.id = incidencia_id and public.es_miembro(i.comunidad_id)
    )
  );

-- Documentos
create policy "documentos_lectura" on public.documentos
  for select to authenticated using (
    public.es_miembro(comunidad_id)
    and (
      visible_para is null
      or exists (
        select 1 from public.miembros m
        where m.comunidad_id = documentos.comunidad_id
          and m.usuario_id = auth.uid()
          and m.rol = any (documentos.visible_para)
      )
    )
  );
create policy "documentos_escritura" on public.documentos
  for all to authenticated using (public.es_administrador(comunidad_id))
  with check (public.es_administrador(comunidad_id));

-- Anuncios
create policy "anuncios_lectura" on public.anuncios
  for select to authenticated using (public.es_miembro(comunidad_id));
create policy "anuncios_escritura" on public.anuncios
  for all to authenticated using (public.es_administrador(comunidad_id))
  with check (public.es_administrador(comunidad_id));

create policy "lecturas_propias" on public.lecturas_anuncio
  for all to authenticated using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- Juntas
create policy "juntas_lectura" on public.juntas
  for select to authenticated using (public.es_miembro(comunidad_id));
create policy "juntas_escritura" on public.juntas
  for all to authenticated using (public.es_administrador(comunidad_id))
  with check (public.es_administrador(comunidad_id));

create policy "puntos_lectura" on public.puntos_del_dia
  for select to authenticated using (
    exists (
      select 1 from public.juntas j
      where j.id = junta_id and public.es_miembro(j.comunidad_id)
    )
  );
create policy "puntos_escritura" on public.puntos_del_dia
  for all to authenticated using (
    exists (
      select 1 from public.juntas j
      where j.id = junta_id and public.es_administrador(j.comunidad_id)
    )
  )
  with check (
    exists (
      select 1 from public.juntas j
      where j.id = junta_id and public.es_administrador(j.comunidad_id)
    )
  );

create policy "asistencias_lectura" on public.asistencias
  for select to authenticated using (
    exists (
      select 1 from public.juntas j
      where j.id = junta_id and public.es_miembro(j.comunidad_id)
    )
  );
create policy "asistencias_escritura" on public.asistencias
  for all to authenticated using (
    exists (
      select 1 from public.juntas j
      where j.id = junta_id and public.es_administrador(j.comunidad_id)
    )
  )
  with check (
    exists (
      select 1 from public.juntas j
      where j.id = junta_id and public.es_administrador(j.comunidad_id)
    )
  );

create policy "votos_lectura" on public.votos
  for select to authenticated using (
    exists (
      select 1 from public.puntos_del_dia p
      join public.juntas j on j.id = p.junta_id
      where p.id = punto_id and public.es_miembro(j.comunidad_id)
    )
  );
create policy "votos_escritura" on public.votos
  for all to authenticated using (
    exists (
      select 1 from public.puntos_del_dia p
      join public.juntas j on j.id = p.junta_id
      where p.id = punto_id and public.es_administrador(j.comunidad_id)
    )
  )
  with check (
    exists (
      select 1 from public.puntos_del_dia p
      join public.juntas j on j.id = p.junta_id
      where p.id = punto_id and public.es_administrador(j.comunidad_id)
    )
  );

-- Acuerdos
create policy "acuerdos_lectura" on public.acuerdos
  for select to authenticated using (public.es_miembro(comunidad_id));
create policy "acuerdos_escritura" on public.acuerdos
  for all to authenticated using (public.es_administrador(comunidad_id))
  with check (public.es_administrador(comunidad_id));

-- Zonas y reservas
create policy "zonas_lectura" on public.zonas_comunes
  for select to authenticated using (public.es_miembro(comunidad_id));
create policy "zonas_escritura" on public.zonas_comunes
  for all to authenticated using (public.es_administrador(comunidad_id))
  with check (public.es_administrador(comunidad_id));

create policy "reservas_lectura" on public.reservas
  for select to authenticated using (public.es_miembro(comunidad_id));
create policy "reservas_crear" on public.reservas
  for insert to authenticated with check (
    public.es_miembro(comunidad_id) and usuario_id = auth.uid()
  );
create policy "reservas_edicion" on public.reservas
  for update to authenticated using (
    public.es_administrador(comunidad_id) or usuario_id = auth.uid()
  )
  with check (
    public.es_administrador(comunidad_id) or usuario_id = auth.uid()
  );
create policy "reservas_borrado" on public.reservas
  for delete to authenticated using (
    public.es_administrador(comunidad_id) or usuario_id = auth.uid()
  );

-- Notificaciones
create policy "notificaciones_propias" on public.notificaciones
  for all to authenticated using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- Auditoria
create policy "auditoria_lectura" on public.auditoria
  for select to authenticated using (public.es_administrador(comunidad_id));

-- ------------------------------------------------------------
-- Permisos
-- ------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
