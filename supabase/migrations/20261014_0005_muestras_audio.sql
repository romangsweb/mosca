-- Fly Punch · paso 5: «Mi kit» y el audio real de las tomas en la nube (Supabase Storage).
-- Cada archivo vive en una carpeta con el id del usuario: <uid>/kit/<voz> y <uid>/tomas/<id-toma>.
-- Solo su dueño lo lee o lo borra; subir es Pro (o prueba vigente). Los buckets son privados.

-- 1 · ¿soy Pro? (envoltorio de is_pro para usarlo en políticas; solo responde por el usuario actual)
create or replace function public.soy_pro() returns boolean
language sql stable security definer set search_path = '' as $$ select public.is_pro(auth.uid()); $$;
revoke all on function public.soy_pro() from public, anon;
grant execute on function public.soy_pro() to authenticated;

-- 2 · buckets privados con límite de tamaño y solo audio
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('muestras', 'muestras', false, 4194304, array['audio/*', 'application/json']),
  ('audio-tomas', 'audio-tomas', false, 26214400, array['audio/*', 'video/webm'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 3 · políticas: la primera carpeta de la ruta tiene que ser tu id
drop policy if exists "fp: leer lo mío" on storage.objects;
create policy "fp: leer lo mío" on storage.objects for select to authenticated
  using (bucket_id in ('muestras', 'audio-tomas') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "fp: subir (Pro)" on storage.objects;
create policy "fp: subir (Pro)" on storage.objects for insert to authenticated
  with check (bucket_id in ('muestras', 'audio-tomas') and (storage.foldername(name))[1] = auth.uid()::text and public.soy_pro());

drop policy if exists "fp: reemplazar (Pro)" on storage.objects;
create policy "fp: reemplazar (Pro)" on storage.objects for update to authenticated
  using (bucket_id in ('muestras', 'audio-tomas') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('muestras', 'audio-tomas') and (storage.foldername(name))[1] = auth.uid()::text and public.soy_pro());

drop policy if exists "fp: borrar lo mío" on storage.objects;
create policy "fp: borrar lo mío" on storage.objects for delete to authenticated
  using (bucket_id in ('muestras', 'audio-tomas') and (storage.foldername(name))[1] = auth.uid()::text);

-- 4 · las tomas recuerdan su compás y si tienen audio real en la nube
alter table public.takes add column if not exists compas    text check (compas in ('4/4', '3/4', '2/4', '6/8', '5/8', '7/8'));
alter table public.takes add column if not exists has_audio boolean not null default false;
grant update (has_audio) on public.takes to authenticated;
grant select (compas) on public.takes to anon; -- las tomas compartidas se escuchan en su compás
