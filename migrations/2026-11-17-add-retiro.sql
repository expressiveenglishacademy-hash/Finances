-- migrations/2026-11-17-add-retiro.sql
-- Additive only. Run this in the Supabase SQL editor when you want
-- "Por retirar" marks to sync between devices.
-- The app does not run this file. Until it is applied, marks stay in
-- this browser's localStorage and nothing in the existing tables changes.
-- Do not edit, drop, or rename any current table or column.

create table if not exists public.income_withdrawals (
  income_id text primary key,
  withdrawn_at date not null,
  created_at timestamptz not null default now()
);

alter table public.income_withdrawals enable row level security;

drop policy if exists "income_withdrawals_authenticated" on public.income_withdrawals;

create policy "income_withdrawals_authenticated"
  on public.income_withdrawals
  for all
  to authenticated
  using (true)
  with check (true);
