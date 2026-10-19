-- ============================================================================
-- calls.sql — additive: call history for "hi"
--
-- Adds public.calls: one row per call, visible to both participants.
-- Direction/reason is derived per viewer:
--   caller             → outgoing  ↗
--   callee + answered  → incoming  ↘
--   callee + missed    → missed    ↙ (red)
--
-- Additive only — nothing existing is created, dropped or rewritten.
-- Re-runnable. Clients insert with caller_id = auth.uid(); the callee row
-- shows up automatically in their history (RLS lets both sides read it).
-- ============================================================================

create table if not exists public.calls (
  id               uuid primary key default gen_random_uuid(),
  caller_id        uuid not null references public.users(id) on delete cascade,
  callee_id        uuid not null references public.users(id) on delete cascade,
  mode             text not null default 'voice' check (mode in ('voice', 'video')),
  answered         boolean not null default false,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  created_at       timestamptz not null default now()
);

create index if not exists calls_caller_created_idx
  on public.calls (caller_id, created_at desc);
create index if not exists calls_callee_created_idx
  on public.calls (callee_id, created_at desc);

alter table public.calls enable row level security;

-- both participants can see the call
drop policy if exists calls_select_participants on public.calls;
create policy calls_select_participants
  on public.calls for select to authenticated
  using (
    caller_id = (select auth.uid())
    or callee_id = (select auth.uid())
  );

-- a call is recorded by its caller
drop policy if exists calls_insert_caller on public.calls;
create policy calls_insert_caller
  on public.calls for insert to authenticated
  with check (caller_id = (select auth.uid()));

-- the caller updates the row when the call ends (duration)
drop policy if exists calls_update_caller on public.calls;
create policy calls_update_caller
  on public.calls for update to authenticated
  using (caller_id = (select auth.uid()))
  with check (caller_id = (select auth.uid()));

-- live updates in the Calls list
do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'calls'
  ) then
    execute 'alter publication supabase_realtime add table public.calls';
  end if;
end
$$;
