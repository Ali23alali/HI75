-- ============================================================================
-- users_realtime.sql — additive: stream public.users changes over Realtime
--
-- Adds the users table to the supabase_realtime publication so presence
-- (and profile) updates fan out live to every connected device.
-- Additive only — no table is created, dropped or rewritten. Re-runnable.
-- ============================================================================

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'users'
  ) then
    execute 'alter publication supabase_realtime add table public.users';
  end if;
end
$$;
