-- Shared store for live ShopX telemetry (backend/app/live.py, SupabaseStore).
-- Only needed for the serverless deployment; local runs keep events in memory.
create table public.live_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  service text not null,
  version text not null,
  db_queries integer not null,
  latency_ms real not null
);
create index live_events_service_id on public.live_events (service, id desc);

-- One row per (service, version): when it first and last reported
create view public.live_versions with (security_invoker = true) as
  select service, version, min(at) as first_at, max(at) as last_at
  from public.live_events group by service, version;

-- Demo telemetry only: the backend reads, writes and clears it with the anon key
alter table public.live_events enable row level security;
create policy "live read" on public.live_events for select to anon using (true);
create policy "live write" on public.live_events for insert to anon with check (true);
create policy "live clear" on public.live_events for delete to anon using (true);
