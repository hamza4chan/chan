-- Journal des visites v2 — lance dans Supabase SQL Editor
-- https://supabase.com/dashboard/project/ajdykmhacevepykrmseo/sql/new

create table if not exists public.visitor_logs (
  id bigint generated always as identity primary key,
  ip text not null,
  isp text,
  org text,
  city text,
  region text,
  country text,
  country_code text,
  latitude double precision,
  longitude double precision,
  asn text,
  ip_type text,
  connection_guess text,
  user_agent text,
  page text default '/',
  device jsonb,
  geo_lat double precision,
  geo_lng double precision,
  geo_accuracy double precision,
  geo_status text,
  created_at timestamptz not null default now()
);

-- Migration depuis v1
alter table public.visitor_logs add column if not exists region text;
alter table public.visitor_logs add column if not exists country_code text;
alter table public.visitor_logs add column if not exists latitude double precision;
alter table public.visitor_logs add column if not exists longitude double precision;
alter table public.visitor_logs add column if not exists asn text;
alter table public.visitor_logs add column if not exists ip_type text;
alter table public.visitor_logs add column if not exists connection_guess text;
alter table public.visitor_logs add column if not exists device jsonb;
alter table public.visitor_logs add column if not exists geo_lat double precision;
alter table public.visitor_logs add column if not exists geo_lng double precision;
alter table public.visitor_logs add column if not exists geo_accuracy double precision;
alter table public.visitor_logs add column if not exists geo_status text;

create index if not exists visitor_logs_created_at_idx on public.visitor_logs (created_at desc);
create index if not exists visitor_logs_ip_idx on public.visitor_logs (ip);

alter table public.visitor_logs enable row level security;

drop policy if exists "visitor_logs_insert" on public.visitor_logs;
create policy "visitor_logs_insert"
  on public.visitor_logs for insert with check (true);

drop policy if exists "visitor_logs_admin_read" on public.visitor_logs;
create policy "visitor_logs_admin_read"
  on public.visitor_logs for select
  using (auth.role() = 'authenticated');

grant insert on public.visitor_logs to anon, authenticated;
grant select on public.visitor_logs to authenticated;
grant all on public.visitor_logs to service_role;
