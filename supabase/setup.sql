-- Hall of Autism — lance ça dans Supabase SQL Editor (UNE FOIS)
-- https://supabase.com/dashboard/project/ajdykmhacevepykrmseo/sql/new

-- Table du site (créée si absente)
create table if not exists public.site_config (
  id bigint primary key,
  title text default 'grossepute.org',
  subtitle text default ''
);

-- Colonnes manquantes pour les fiches et les photos
alter table public.site_config
  add column if not exists people jsonb not null default '[]'::jsonb,
  add column if not exists images jsonb not null default '{}'::jsonb;

-- Nouveau moteur de contenu : blocs éditables (texte, titre, image, ascii, emoji, lien)
alter table public.site_config
  add column if not exists blocks jsonb not null default '[]'::jsonb,
  add column if not exists theme text,
  add column if not exists updated_at timestamptz not null default now();

-- Ligne unique du site (id = 1) si absente
insert into public.site_config (id, title, subtitle, blocks)
  values (1, 'grossepute.org', 'transmission en cours', '[]'::jsonb)
  on conflict (id) do nothing;

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

-- Journal des visites v2 (IP, FAI, device, GPS, type connexion)
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
  on public.visitor_logs for insert
  with check (true);

drop policy if exists "visitor_logs_admin_read" on public.visitor_logs;
create policy "visitor_logs_admin_read"
  on public.visitor_logs for select
  using (auth.role() = 'authenticated');

grant insert on public.visitor_logs to anon, authenticated;
grant select on public.visitor_logs to authenticated;
grant all on public.visitor_logs to service_role;

-- ————————————————————————————————————————————————
-- Stockage des médias (photos uploadées par l'admin)
-- Bucket public « media » : lecture pour tous, écriture pour l'admin connecté
-- ————————————————————————————————————————————————
insert into storage.buckets (id, name, public)
  values ('media', 'media', true)
  on conflict (id) do update set public = true;

drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read"
  on storage.objects for select
  using (bucket_id = 'media');

drop policy if exists "media_auth_insert" on storage.objects;
create policy "media_auth_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media');

drop policy if exists "media_auth_update" on storage.objects;
create policy "media_auth_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'media')
  with check (bucket_id = 'media');

drop policy if exists "media_auth_delete" on storage.objects;
create policy "media_auth_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media');

