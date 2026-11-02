-- El telefono pasa a ser el identificador de acceso de los vecinos.
-- Se guarda en perfiles.telefono (columna que ya existia) y no se permiten
-- dos cuentas con el mismo numero.

create unique index if not exists uq_perfiles_telefono
  on public.perfiles (telefono)
  where telefono is not null;
