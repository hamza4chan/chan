-- Hall of Autism — lance ça dans Supabase SQL Editor (UNE FOIS)
-- https://supabase.com/dashboard/project/ajdykmhacevepykrmseo/sql/new

-- Colonnes manquantes pour les fiches et les photos
alter table public.site_config
  add column if not exists people jsonb not null default '[]'::jsonb,
  add column if not exists images jsonb not null default '{}'::jsonb;

-- Permissions lecture publique / écriture admin connecté
alter table public.site_config enable row level security;

drop policy if exists "site_config_public_read" on public.site_config;
create policy "site_config_public_read"
  on public.site_config for select using (true);

drop policy if exists "site_config_auth_insert" on public.site_config;
create policy "site_config_auth_insert"
  on public.site_config for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "site_config_auth_update" on public.site_config;
create policy "site_config_auth_update"
  on public.site_config for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

grant select on public.site_config to anon, authenticated;
grant insert, update, delete on public.site_config to authenticated;

-- Realtime (sync live)
do $$
begin
  alter publication supabase_realtime add table public.site_config;
exception when duplicate_object then null;
end $$;

-- Journal des visites (IP + FAI)
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
  on public.visitor_logs for insert
  with check (true);

drop policy if exists "visitor_logs_admin_read" on public.visitor_logs;
create policy "visitor_logs_admin_read"
  on public.visitor_logs for select
  using (auth.role() = 'authenticated');

grant insert on public.visitor_logs to anon, authenticated;
grant select on public.visitor_logs to authenticated;
grant all on public.visitor_logs to service_role;

