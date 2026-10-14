-- Fly Punch · paso 2: tomas en la nube.
-- Cada toma pertenece a un usuario. Free: máximo 5 tomas (lo aplica la base de datos, no la app). Pro: sin límite.

create table if not exists public.takes (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  created_at  timestamptz not null default now(),
  bpm         int  not null check (bpm between 20 and 400),
  dur_ms      int  not null check (dur_ms >= 0),
  steps       int  not null default 0,
  source      text,
  tracks      jsonb not null default '[]'::jsonb,
  inputs      jsonb not null default '{}'::jsonb,
  events      jsonb not null default '[]'::jsonb check (octet_length(events::text) < 2000000),
  n_events    int generated always as (jsonb_array_length(events)) stored,
  updated_at  timestamptz not null default now()
);
create index if not exists takes_user_created on public.takes (user_id, created_at desc);

alter table public.takes enable row level security;
create policy "tomas: leer las propias"   on public.takes for select to authenticated using ((select auth.uid()) = user_id);
create policy "tomas: crear las propias"  on public.takes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tomas: renombrar propias"  on public.takes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tomas: borrar las propias" on public.takes for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.takes from anon, authenticated;
grant select, insert, delete on public.takes to authenticated;
grant update (name) on public.takes to authenticated;

drop trigger if exists takes_touch on public.takes;
create trigger takes_touch before update on public.takes
  for each row execute function public.touch_updated_at();

-- límite del plan Free
create or replace function public.enforce_take_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_plan text; v_count int;
begin
  select plan into v_plan from public.profiles where id = new.user_id;
  if coalesce(v_plan, 'free') <> 'pro' then
    select count(*) into v_count from public.takes where user_id = new.user_id;
    if v_count >= 5 then
      raise exception 'limite_free' using errcode = 'P0001', hint = 'El plan Free guarda 5 tomas en la nube.';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists takes_limit on public.takes;
create trigger takes_limit before insert on public.takes
  for each row execute function public.enforce_take_limit();
