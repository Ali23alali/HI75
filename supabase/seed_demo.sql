-- ============================================================================
-- seed_demo.sql — optional demo dataset for "hi"
--
-- Creates 4 confirmed accounts (password: demo1234):
--   demo@hi.app  ·  maya@hi.app  ·  leo@hi.app  ·  sofia@hi.app
--
-- …plus contacts, direct chats, a "hi AI" conversation and active stories.
-- Safe to re-run: demo rows are replaced each time.
--
-- Run it with the Supabase CLI:   supabase db execute --file supabase/seed_demo.sql
-- (or paste into the SQL editor). This is DATA ONLY — the schema is untouched.
-- ============================================================================

-- 1) replace previous demo rows -------------------------------------------------
delete from public.conversations
 where id in (
   'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000002',
   'aaaaaaaa-0000-4000-8000-000000000003',
   'aaaaaaaa-0000-4000-8000-00000000000f'
 );

delete from auth.users
 where id in (
   '11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333333',
   '44444444-4444-4444-8444-444444444444'
 );

-- 2) accounts (auth.users + identities + profiles) ------------------------------
do $seed$
declare
  rec record;
begin
  for rec in
    select *
      from jsonb_to_recordset($json$[
        {"id":"11111111-1111-4111-8111-111111111111","email":"demo@hi.app", "username":"demo", "name":"Demo User",  "avatar":"/avatars/a1.jpg","bio":"Just saying hi.",          "status":"online"},
        {"id":"22222222-2222-4222-8222-222222222222","email":"maya@hi.app", "username":"maya", "name":"Maya Chen",  "avatar":"/avatars/a2.jpg","bio":"Design @ hi.",             "status":"idle"},
        {"id":"33333333-3333-4333-8333-333333333333","email":"leo@hi.app",  "username":"leo",  "name":"Leo Park",   "avatar":"/avatars/a3.jpg","bio":"Rides bikes, ships apps.","status":"dnd"},
        {"id":"44444444-4444-4444-8444-444444444444","email":"sofia@hi.app","username":"sofia","name":"Sofia Reyes","avatar":"/avatars/a4.jpg","bio":"Golden hour chaser.",     "status":"online"}
      ]$json$::jsonb) as x(id uuid, email text, username text, name text, avatar text, bio text, status text)
  loop
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, email_change_confirm_status, phone_change,
      phone_change_token, reauthentication_token, is_sso_user, is_anonymous
    ) values (
      rec.id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      rec.email,
      extensions.crypt('demo1234', extensions.gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('username', rec.username, 'display_name', rec.name),
      now(),
      now(),
      '', '', '', '', '', 0, '', '', '',
      false,
      false
    );

    insert into auth.identities
      (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(),
      rec.id::text,
      rec.id,
      jsonb_build_object('sub', rec.id::text, 'email', rec.email, 'email_verified', true, 'phone_verified', false),
      'email',
      now(), now(), now()
    );

    update public.users
       set display_name = rec.name,
           avatar_url   = rec.avatar,
           bio          = rec.bio,
           status       = coalesce(rec.status, 'online')
     where id = rec.id;
  end loop;
end
$seed$;

-- 3) contacts (accepted, both directions) ---------------------------------------
insert into public.contacts (user_id, friend_id, status) values
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'accepted'),
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'accepted'),
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'accepted'),
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'accepted'),
  ('11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', 'accepted'),
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'accepted'),
  ('22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', 'accepted'),
  ('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'accepted')
on conflict do nothing;

-- 4) conversations + members -----------------------------------------------------
insert into public.conversations (id, type, title, created_by) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'direct', null,    '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'direct', null,    '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'direct', null,    '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-0000-4000-8000-00000000000f', 'ai',     'hi AI', '11111111-1111-4111-8111-111111111111');

insert into public.conversation_members (conversation_id, user_id, last_read_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', now() - interval '2 hours'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', now()),
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', now()),
  ('aaaaaaaa-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', now()),
  ('aaaaaaaa-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', now()),
  ('aaaaaaaa-0000-4000-8000-000000000003', '44444444-4444-4444-8444-444444444444', now()),
  ('aaaaaaaa-0000-4000-8000-00000000000f', '11111111-1111-4111-8111-111111111111', now());

-- 5) messages -------------------------------------------------------------------
insert into public.messages (id, conversation_id, sender_id, body, is_ai, created_at) values
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Hey Maya! Welcome to hi 👋',                          false, now() - interval '48 hours'),
  ('cccccccc-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'This is so clean. The dark UI is gorgeous.',          false, now() - interval '48 hours' + interval '6 minutes'),
  ('cccccccc-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'And the AI assistant actually helps write replies.',  false, now() - interval '26 hours'),
  ('cccccccc-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Can''t wait to try stories.',                         false, now() - interval '3 hours'),
  ('cccccccc-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Are you around later?',                               false, now() - interval '5 minutes'),
  ('cccccccc-0000-4000-8000-000000000006', 'aaaaaaaa-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 'yo! seen the new build?',                             false, now() - interval '30 hours'),
  ('cccccccc-0000-4000-8000-000000000007', 'aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Yes — messages land instantly now 🔥',                false, now() - interval '29 hours'),
  ('cccccccc-0000-4000-8000-000000000008', 'aaaaaaaa-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 'Nice. Stories next?',                                 false, now() - interval '21 hours'),
  ('cccccccc-0000-4000-8000-000000000009', 'aaaaaaaa-0000-4000-8000-000000000003', '44444444-4444-4444-8444-444444444444', 'Coffee tomorrow? ☕',                                  false, now() - interval '96 hours'),
  ('cccccccc-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Sure — 10am works. See you there.',                   false, now() - interval '95 hours'),
  ('cccccccc-0000-4000-8000-00000000000b', 'aaaaaaaa-0000-4000-8000-00000000000f', null,                                   'Hi! I''m hi AI ✨ Ask me anything — I can help draft replies, plan your day, or just chat.', true, now() - interval '1 hour');

update public.conversations c
   set last_message_at = (
     select max(m.created_at) from public.messages m where m.conversation_id = c.id
   )
 where c.id in (
   'aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000002',
   'aaaaaaaa-0000-4000-8000-000000000003',
   'aaaaaaaa-0000-4000-8000-00000000000f'
 );

-- 6) active stories + one viewed record -----------------------------------------
insert into public.stories (id, user_id, media_url, caption, created_at, expires_at) values
  ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '/avatars/a2.jpg', 'Studio day.',      now() - interval '2 hours',   now() + interval '22 hours'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', '/avatars/a5.jpg', 'Sketchbook.',      now() - interval '1 hour',    now() + interval '23 hours'),
  ('bbbbbbbb-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333', '/avatars/a3.jpg', 'Weekend ride 🏍️', now() - interval '4 hours',   now() + interval '20 hours'),
  ('bbbbbbbb-0000-4000-8000-000000000004', '44444444-4444-4444-8444-444444444444', '/avatars/a4.jpg', 'Golden hour.',     now() - interval '30 minutes', now() + interval '23 hours');

insert into public.story_views (story_id, viewer_id, viewed_at) values
  ('bbbbbbbb-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', now() - interval '10 minutes')
on conflict do nothing;
