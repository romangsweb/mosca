-- Fly Punch · 0007 · Productor IA (beta Pro): cuota por usuario y tope global al mes
-- El tope global es nuestro freno de gasto: aunque Google no corte, la función deja de llamar a Gemini al llegar a él.

create table if not exists public.ia_uso (
  user_id uuid not null references auth.users on delete cascade,
  mes text not null,               -- 'AAAA-MM' en UTC
  n int not null default 0,
  primary key (user_id, mes)
);
alter table public.ia_uso enable row level security;
drop policy if exists "ia_uso: veo el mío" on public.ia_uso;
create policy "ia_uso: veo el mío" on public.ia_uso for select using (auth.uid() = user_id);

create table if not exists public.ia_global (mes text primary key, n int not null default 0);
alter table public.ia_global enable row level security; -- sin políticas: solo la función (service role) la toca

-- reserva una consulta: devuelve las que quedan (≥ 0), −1 si el usuario ya usó las suyas, −2 si se llegó al tope global
create or replace function public.ia_consumir(uid uuid, por_usuario int, global_max int) returns int
language plpgsql security definer set search_path = '' as $$
declare m text := to_char(now() at time zone 'utc', 'YYYY-MM'); g int; u int;
begin
  insert into public.ia_global (mes, n) values (m, 0) on conflict do nothing;
  select n into g from public.ia_global where mes = m for update;
  if g >= global_max then return -2; end if;
  insert into public.ia_uso (user_id, mes, n) values (uid, m, 0) on conflict do nothing;
  select n into u from public.ia_uso where user_id = uid and mes = m for update;
  if u >= por_usuario then return -1; end if;
  update public.ia_uso set n = n + 1 where user_id = uid and mes = m;
  update public.ia_global set n = n + 1 where mes = m;
  return por_usuario - u - 1;
end $$;

-- si Gemini falla, la consulta no cuenta
create or replace function public.ia_devolver(uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare m text := to_char(now() at time zone 'utc', 'YYYY-MM');
begin
  update public.ia_uso set n = greatest(0, n - 1) where user_id = uid and mes = m;
  update public.ia_global set n = greatest(0, n - 1) where mes = m;
end $$;

revoke all on function public.ia_consumir(uuid, int, int) from public, anon, authenticated;
revoke all on function public.ia_devolver(uuid) from public, anon, authenticated;
