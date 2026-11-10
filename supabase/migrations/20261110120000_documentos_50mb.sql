-- ============================================================
-- Documentos: limite de 50 MB por PDF
-- ============================================================
-- La subida se hace directamente desde el navegador a Supabase Storage
-- para no pasar por el limite de 4,5 MB de las funciones de Vercel.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit;
