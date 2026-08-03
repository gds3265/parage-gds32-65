create table if not exists public.parage_backups (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.parage_backups enable row level security;
create policy "public app backup read" on public.parage_backups for select using (true);
create policy "public app backup insert" on public.parage_backups for insert with check (true);
create policy "public app backup update" on public.parage_backups for update using (true) with check (true);
