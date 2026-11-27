-- ============================================================
-- Envio de la convocatoria y control de plazos (art. 9.1.h y 16 LPH)
-- ============================================================
-- Se guarda cuando se envio la convocatoria y por que medios, para poder
-- demostrar la antelacion: al menos 6 dias en la junta ordinaria y la
-- suficiente en la extraordinaria (art. 16.3).

alter table public.juntas
  add column if not exists convocatoria_enviada_en timestamptz,
  add column if not exists convocatoria_medios text[] not null default '{}',
  add column if not exists convocatoria_anuncio_id uuid references public.anuncios (id) on delete set null;
