-- ================================================================
-- SUIVI PARAGE V3.0 — AUTHENTIFICATION, ROLES ET BASE PARTAGEE
-- A exécuter une seule fois dans Supabase > SQL Editor > New query
-- ================================================================

create extension if not exists pgcrypto;

-- Profils utilisateurs et rôles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'technicien' check (role in ('admin','pareuse','comptable','technicien')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Création automatique du profil à la création d'un compte Auth.
-- Le premier compte créé devient administrateur ; les suivants techniciens
-- jusqu'à attribution du rôle par l'administratrice dans l'application.
create or replace function public.handle_new_parage_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare first_role text;
begin
  select case when count(*)=0 then 'admin' else 'technicien' end into first_role from public.profiles;
  insert into public.profiles(id,email,display_name,role)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1)),first_role)
  on conflict(id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_parage on auth.users;
create trigger on_auth_user_created_parage
after insert on auth.users
for each row execute function public.handle_new_parage_user();

-- Crée un profil pour les comptes déjà existants
insert into public.profiles(id,email,display_name,role)
select u.id,u.email,coalesce(u.raw_user_meta_data->>'display_name',split_part(u.email,'@',1)),'technicien'
from auth.users u
on conflict(id) do nothing;

-- Garantit qu'il existe au moins un administrateur.
update public.profiles
set role='admin'
where id=(select id from public.profiles order by created_at asc limit 1)
  and not exists(select 1 from public.profiles where role='admin');

-- Sauvegarde partagée de l'application
create table if not exists public.parage_backups (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.parage_backups enable row level security;

create or replace function public.parage_current_role()
returns text
language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() and active=true $$;

-- Nettoyage des anciennes politiques
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname='public' AND tablename IN ('profiles','parage_backups') LOOP
    EXECUTE format('drop policy if exists %I on public.%I',r.policyname,r.tablename);
  END LOOP;
END $$;

-- Profils : chacun lit son profil ; l'admin lit et modifie tout
create policy profiles_read_own_or_admin on public.profiles
for select to authenticated
using (id=auth.uid() or public.parage_current_role()='admin');

create policy profiles_admin_update on public.profiles
for update to authenticated
using (public.parage_current_role()='admin')
with check (public.parage_current_role()='admin');

-- Données métier : tous les profils actifs lisent la base commune
create policy parage_read_authenticated on public.parage_backups
for select to authenticated
using (public.parage_current_role() in ('admin','pareuse','comptable','technicien'));

-- Admin, pareuse et comptable peuvent synchroniser les mises à jour.
-- Le technicien reste strictement en lecture.
create policy parage_insert_roles on public.parage_backups
for insert to authenticated
with check (public.parage_current_role() in ('admin','pareuse','comptable'));

create policy parage_update_roles on public.parage_backups
for update to authenticated
using (public.parage_current_role() in ('admin','pareuse','comptable'))
with check (public.parage_current_role() in ('admin','pareuse','comptable'));

revoke all on public.profiles from anon;
revoke all on public.parage_backups from anon;
grant select on public.profiles to authenticated;
grant update(role,active,display_name,updated_at) on public.profiles to authenticated;
grant select,insert,update on public.parage_backups to authenticated;

-- Mise à jour automatique de updated_at des profils
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- Vérification rapide : les deux tables doivent apparaître dans Table Editor.
select 'Installation Suivi Parage V3.0 terminée' as resultat;
