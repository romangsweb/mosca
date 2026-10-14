-- Fly Punch · compartir tomas por enlace.
-- Una toma pública se puede leer sin cuenta (solo columnas de la música, nunca el user_id). Solo su dueño la publica o la retira.

alter table public.takes add column if not exists public   boolean not null default false;
alter table public.takes add column if not exists share_id text unique check (share_id ~ '^[a-z0-9]{8,16}$');
alter table public.takes add column if not exists author   text check (char_length(author) <= 40);

drop policy if exists "tomas: leer las públicas" on public.takes;
create policy "tomas: leer las públicas" on public.takes for select to anon, authenticated using (public);

grant select (id, name, created_at, bpm, dur_ms, steps, tracks, inputs, events, n_events, public, share_id, author) on public.takes to anon;
grant update (name, public, share_id, author) on public.takes to authenticated;
