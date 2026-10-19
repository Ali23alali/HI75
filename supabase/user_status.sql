-- ============================================================================
-- user_status.sql — additive: presence status on public.users
--
-- Adds the `status` column behind the Online / Idle / Do Not Disturb picker
-- in the account sheet. Additive only — no table is created, dropped or
-- rewritten; existing rows backfill to 'online' via the column default.
-- ============================================================================

alter table public.users
  add column if not exists status text not null default 'online'
  constraint users_status_check check (status in ('online', 'idle', 'dnd'));
