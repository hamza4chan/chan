-- ═══════════════════════════════════════════════════════════════
-- Hall of Autism — config Supabase (à lancer UNE FOIS)
-- Supabase Dashboard → SQL Editor → coller → Run
-- ═══════════════════════════════════════════════════════════════

-- Colonnes nécessaires (safe si déjà présentes)
alter table public.site_config
  add column if not exists id text,
  add column if not exists title text,
  add column if not exists subtitle text,
  add column if not exists people jsonb not null default '[]'::jsonb,
  add column if not exists images jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

-- Clé unique sur id
create unique index if not exists site_config_id_key on public.site_config (id);

-- Ligne principale
insert into public.site_config (id, title, subtitle, people, images)
values (
  'main',
  '/aut/ — Hall of Autism',
  'Galerie des plus grands esprits jamais diagnostiqués',
  '[]'::jsonb,
  '{}'::jsonb
)
on conflict (id) do nothing;

-- Sécurité : tout le monde lit, seuls les admins connectés écrivent
alter table public.site_config enable row level security;

drop policy if exists "site_config_public_read" on public.site_config;
create policy "site_config_public_read"
  on public.site_config for select
  using (true);

drop policy if exists "site_config_auth_insert" on public.site_config;
create policy "site_config_auth_insert"
  on public.site_config for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "site_config_auth_update" on public.site_config;
create policy "site_config_auth_update"
  on public.site_config for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "site_config_auth_delete" on public.site_config;
create policy "site_config_auth_delete"
  on public.site_config for delete
  using (auth.role() = 'authenticated');

grant select on public.site_config to anon, authenticated;
grant insert, update, delete on public.site_config to authenticated;
grant all on public.site_config to service_role;

-- Realtime (sync live entre onglets / visiteurs)
do $$
begin
  alter publication supabase_realtime add table public.site_config;
exception
  when duplicate_object then null;
end $$;
