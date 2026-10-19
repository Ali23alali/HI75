-- ============================================================================
-- ai_and_storage.sql — additive setup for "hi"
--
-- 1) storage.objects policies so the app can upload/read files
--    (buckets already exist: avatars, stories, chat-media)
-- 2) two SECURITY DEFINER helpers so the client can create its AI
--    conversation and the Edge Function can post the AI reply.
--
-- No table is created, dropped or altered. Safe to re-run.
-- ============================================================================

-- 1) storage policies ----------------------------------------------------------

drop policy if exists "hi avatars read"          on storage.objects;
drop policy if exists "hi avatars insert own"    on storage.objects;
drop policy if exists "hi avatars update own"    on storage.objects;
drop policy if exists "hi avatars delete own"    on storage.objects;
drop policy if exists "hi stories read"          on storage.objects;
drop policy if exists "hi stories insert own"    on storage.objects;
drop policy if exists "hi stories update own"    on storage.objects;
drop policy if exists "hi stories delete own"    on storage.objects;
drop policy if exists "hi chat media read"       on storage.objects;
drop policy if exists "hi chat media insert"     on storage.objects;
drop policy if exists "hi chat media delete own" on storage.objects;

-- avatars: publicly readable, only the owner can write in their own folder
create policy "hi avatars read"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

create policy "hi avatars insert own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "hi avatars update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "hi avatars delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- stories: publicly readable, owner-only writes (path: <user_id>/<file>)
create policy "hi stories read"
  on storage.objects for select to public
  using (bucket_id = 'stories');

create policy "hi stories insert own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'stories' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "hi stories update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'stories' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'stories' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "hi stories delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'stories' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- chat media: private; path is <conversation_id>/<file>, so membership is
-- derived from the first folder. Owners can delete their uploads.
create policy "hi chat media read"
  on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and public.is_member(((storage.foldername(name))[1])::uuid));

create policy "hi chat media insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media' and public.is_member(((storage.foldername(name))[1])::uuid));

create policy "hi chat media delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'chat-media' and owner = (select auth.uid()));

-- 2) AI helpers -----------------------------------------------------------------

create or replace function public.start_ai_chat()
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me  uuid := (select auth.uid());
  cid uuid;
begin
  if me is null then
    raise exception 'start_ai_chat: not signed in';
  end if;

  select c.id into cid
  from public.conversations c
  join public.conversation_members m
    on m.conversation_id = c.id and m.user_id = me
  where c.type = 'ai'
  limit 1;

  if cid is not null then
    return cid;
  end if;

  insert into public.conversations (type, title, created_by)
  values ('ai', 'hi AI', me)
  returning id into cid;

  insert into public.conversation_members (conversation_id, user_id, last_read_at)
  values (cid, me, now());

  return cid;
end;
$$;

create or replace function public.post_ai_reply(cid uuid, body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  new_id uuid;
begin
  if me is null then
    raise exception 'post_ai_reply: not signed in';
  end if;
  if body is null or btrim(body) = '' then
    raise exception 'post_ai_reply: empty reply';
  end if;

  -- only a member of this user's own AI conversation may post
  if not exists (
    select 1
    from public.conversations c
    join public.conversation_members m
      on m.conversation_id = c.id and m.user_id = me
    where c.id = cid and c.type = 'ai'
  ) then
    raise exception 'post_ai_reply: not an AI conversation of this user';
  end if;

  insert into public.messages (conversation_id, sender_id, body, is_ai)
  values (cid, null, left(btrim(body), 4000), true)
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.start_ai_chat() from public;
revoke execute on function public.post_ai_reply(uuid, text) from public;
grant execute on function public.start_ai_chat() to authenticated;
grant execute on function public.post_ai_reply(uuid, text) to authenticated;
