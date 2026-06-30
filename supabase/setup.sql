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
