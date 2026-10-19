-- ============================================================================
-- chat_history.sql — additive: per-account message hiding + clear history
--
-- hidden_message_ids: message ids hidden for this member ("delete for me")
-- cleared_at:         cutoff for "Clear chat history" (older messages disappear
--                     for this member only; other members keep their copy)
--
-- Additive only — no table is created, dropped or rewritten. Re-runnable.
-- The existing conversation_members_update_own RLS policy already lets a user
-- update their own membership row.
-- ============================================================================

alter table public.conversation_members
  add column if not exists hidden_message_ids uuid[] not null default '{}'::uuid[],
  add column if not exists cleared_at timestamptz;

comment on column public.conversation_members.hidden_message_ids is
  'Messages hidden for this member only (delete for me).';
comment on column public.conversation_members.cleared_at is
  'Chat history before this timestamp is hidden for this member only.';
