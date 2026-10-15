-- Fly Punch · paso 6: pagos con Paddle.
-- El plan solo lo cambia el webhook (función paddle-webhook con la service role). El cliente puede leer su estado, nunca escribirlo.

alter table public.profiles
  add column if not exists paddle_customer_id     text,
  add column if not exists paddle_subscription_id text,
  add column if not exists plan_status            text,        -- active · trialing · past_due · paused · canceled
  add column if not exists plan_cycle             text check (plan_cycle in ('mes', 'año')),
  add column if not exists plan_renews_at         timestamptz,  -- próxima renovación, o fin del periodo pagado si cancelaste
  add column if not exists plan_cancel_at         timestamptz,  -- si la cancelación ya está programada
  add column if not exists plan_event_at          timestamptz;  -- último evento aplicado (Paddle no garantiza el orden)

create unique index if not exists profiles_paddle_customer on public.profiles (paddle_customer_id) where paddle_customer_id is not null;

-- registro de eventos ya procesados: Paddle reintenta, así no se aplica dos veces
create table if not exists public.paddle_events (
  id          text primary key,
  type        text not null,
  user_id     uuid,
  received_at timestamptz not null default now()
);
alter table public.paddle_events enable row level security; -- sin políticas: solo la service role lo toca
revoke all on public.paddle_events from anon, authenticated;
