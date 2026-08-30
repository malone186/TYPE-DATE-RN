-- Server-side Android purchase ledger.
-- Apply after the base schema. The raw purchase token is never stored.

create table if not exists public.purchase_transactions (
  id                     bigserial primary key,
  user_id                uuid references auth.users(id) on delete set null,
  platform               text not null check (platform in ('android')),
  package_name           text not null,
  product_id             text not null,
  transaction_id         text,
  purchase_time          timestamptz,
  status                 text not null check (status in ('purchased', 'pending', 'cancelled', 'unknown')),
  is_test                boolean not null default false,
  acknowledgement_status text not null check (acknowledgement_status in ('acknowledged', 'pending', 'not_required')),
  purchase_token_hash    text not null check (length(purchase_token_hash) = 43),
  last_verified_at       timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  unique (purchase_token_hash)
);

create index if not exists purchase_transactions_status_idx
  on public.purchase_transactions (status, is_test, last_verified_at desc);

alter table public.purchase_transactions enable row level security;
drop policy if exists "admins can read purchase transactions" on public.purchase_transactions;
create policy "admins can read purchase transactions"
  on public.purchase_transactions for select
  to authenticated
  using (public.is_admin());

revoke all on public.purchase_transactions from anon, authenticated;
grant select on public.purchase_transactions to authenticated;
