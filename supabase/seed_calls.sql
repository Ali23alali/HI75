-- ============================================================================
-- seed_calls.sql — demo call history so the Calls tab shows all three kinds
-- (outgoing ↗ / incoming ↘ / missed ↙) right away.
--
-- These are example rows for the demo user "ahmed"; every statement is a
-- no-op if the accounts don't exist, and re-running changes nothing.
-- Remove the samples with:
--   delete from public.calls where id::text like 'c0a11111-%';
-- ============================================================================

-- missed voice call from Ali (yesterday evening)
insert into public.calls (id, caller_id, callee_id, mode, answered, duration_seconds, created_at)
select 'c0a11111-0000-4000-8000-000000000001', a.id, b.id, 'voice', false, 0,
       date_trunc('day', now()) - interval '1 day' + interval '18 hours 12 minutes'
  from public.users a, public.users b
 where a.username = 'ali' and b.username = 'ahmed'
on conflict (id) do nothing;

-- answered video call from Defe (three days ago, 4m 32s)
insert into public.calls (id, caller_id, callee_id, mode, answered, duration_seconds, created_at)
select 'c0a11111-0000-4000-8000-000000000002', a.id, b.id, 'video', true, 272,
       date_trunc('day', now()) - interval '3 days' + interval '11 hours 5 minutes'
  from public.users a, public.users b
 where a.username = 'defe' and b.username = 'ahmed'
on conflict (id) do nothing;

-- outgoing voice call to Ali (today, unanswered)
insert into public.calls (id, caller_id, callee_id, mode, answered, duration_seconds, created_at)
select 'c0a11111-0000-4000-8000-000000000003', a.id, b.id, 'voice', false, 9,
       date_trunc('day', now()) + interval '10 hours 24 minutes'
  from public.users a, public.users b
 where a.username = 'ahmed' and b.username = 'ali'
on conflict (id) do nothing;

-- outgoing video call to Azi (six days ago, unanswered)
insert into public.calls (id, caller_id, callee_id, mode, answered, duration_seconds, created_at)
select 'c0a11111-0000-4000-8000-000000000004', a.id, b.id, 'video', false, 14,
       date_trunc('day', now()) - interval '6 days' + interval '20 hours 41 minutes'
  from public.users a, public.users b
 where a.username = 'ahmed' and b.username = 'azi'
on conflict (id) do nothing;
