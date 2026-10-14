-- Fly Punch · paso 3: planes Free/Pro y prueba de 7 días.
-- Pro efectivo = plan 'pro' (lo pondrá el webhook de pagos) o una prueba vigente.
-- La prueba se activa una sola vez por cuenta y solo desde el servidor (función start_trial).

alter table public.profiles
  add column if not exists trial_ends_at timestamptz,
  add column if not exists trial_used boolean not null default false;

create or replace function public.is_pro(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.plan = 'pro' or coalesce(p.trial_ends_at > now(), false)
                   from public.profiles p where p.id = uid), false);
$$;
revoke all on function public.is_pro(uuid) from public, anon, authenticated;

-- el límite de 5 tomas ahora respeta la prueba
create or replace function public.enforce_take_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  if not public.is_pro(new.user_id) then
    select count(*) into v_count from public.takes where user_id = new.user_id;
    if v_count >= 5 then
      raise exception 'limite_free' using errcode = 'P0001', hint = 'El plan Free guarda 5 tomas en la nube.';
    end if;
  end if;
  return new;
end; $$;

create or replace function public.start_trial() returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare v_end timestamptz;
begin
  update public.profiles
     set trial_used = true, trial_ends_at = now() + interval '7 days'
   where id = auth.uid() and not trial_used and plan <> 'pro'
  returning trial_ends_at into v_end;
  if v_end is null then
    raise exception 'prueba_no_disponible' using errcode = 'P0001';
  end if;
  return v_end;
end; $$;
revoke all on function public.start_trial() from public, anon;
grant execute on function public.start_trial() to authenticated;
