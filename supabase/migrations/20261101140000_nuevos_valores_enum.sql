-- Nuevos valores de enum.
-- Van en una migracion aparte porque PostgreSQL no permite usar un valor
-- recien anadido dentro de la misma transaccion que lo crea.

alter type public.rol_miembro add value if not exists 'vecino';

alter type public.tipo_finca add value if not exists 'casa';
alter type public.tipo_finca add value if not exists 'piso';
