-- Maison Tracé accounts: paste this into Supabase > SQL Editor > New query and run it once.
-- Sign-in itself (users, emailed links and codes) is Supabase's own; this adds what the app keeps per person.

-- Everything the app keeps for someone: one row each, the same shape as a backup file (see src/account.ts).
create table if not exists public.backups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.backups enable row level security;

-- Each person reads and writes only their own row.
drop policy if exists "own backup: read" on public.backups;
create policy "own backup: read" on public.backups for select using (auth.uid() = user_id);
drop policy if exists "own backup: add" on public.backups;
create policy "own backup: add" on public.backups for insert with check (auth.uid() = user_id);
drop policy if exists "own backup: change" on public.backups;
create policy "own backup: change" on public.backups for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- What someone has bought (garment packs, Premium, the founding pass). Written only by the server when the payment
-- company confirms a payment, so it can't be added from the app; people can read their own.
-- Kept (without the person) when an account is deleted, as sales records are needed for tax.
create table if not exists public.purchases (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('pack', 'premium', 'maker', 'founding')),
  -- The garment a pack is for (e.g. 'dress'); empty for plans.
  item text,
  provider text not null default 'paddle',
  provider_ref text not null unique,
  amount_cents integer not null,
  currency text not null default 'USD',
  bought_at timestamptz not null default now(),
  ends_at timestamptz,
  refunded_at timestamptz
);

create index if not exists purchases_user on public.purchases (user_id);

alter table public.purchases enable row level security;

drop policy if exists "own purchases: read" on public.purchases;
create policy "own purchases: read" on public.purchases for select using (auth.uid() = user_id);
-- No insert/update/delete policies: only the service role key (on the server) can write.
