-- Fly Punch · paso 1: perfiles y ajustes sincronizados.
-- Cada usuario de Supabase Auth tiene un perfil. El plan (free/pro) solo lo cambia el servidor
-- (más adelante, el webhook de pagos con la service role); el usuario no puede tocarlo.

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  alias       text check (char_length(alias) <= 40),
  plan        text not null default 'free' check (plan in ('free', 'pro')),
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- leer y actualizar solo tu propio perfil
create policy "perfil: leer el propio" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "perfil: actualizar el propio" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- el cliente solo puede escribir alias y settings (no plan, no id)
revoke update on public.profiles from authenticated, anon;
grant select on public.profiles to authenticated;
grant update (alias, settings) on public.profiles to authenticated;

-- updated_at automático
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- crear el perfil al registrarse
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, alias)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), 40))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
