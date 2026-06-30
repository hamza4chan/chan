-- Colle ça dans Supabase SQL Editor → Run
-- https://supabase.com/dashboard/project/ajdykmhacevepykrmseo/sql/new

create table if not exists public.visitor_logs (
  id bigint generated always as identity primary key,
  ip text not null,
  isp text,
  org text,
  city text,
  country text,
  user_agent text,
  page text default '/',
  created_at timestamptz not null default now()
);

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
