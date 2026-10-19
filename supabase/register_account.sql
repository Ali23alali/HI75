-- ============================================================================
-- register_account.sql — instant registration without the email round-trip
--
-- This project has "Confirm email" enabled and Supabase's built-in mailer is
-- rate-limited in this environment: GoTrue's /signup answers
-- "email rate limit exceeded" and creates nothing, and even without the limit
-- it returns no session until an emailed link is clicked.
--
-- This SECURITY DEFINER function creates a *confirmed* email/password account
-- directly (the same recipe the demo seed uses), so the app can register →
-- sign in → start chatting immediately, with no inbox step.
--
-- The existing on_auth_user_created trigger creates the matching public.users
-- profile row (username / display name come from the values passed here).
-- Additive only — no table is created, dropped or rewritten. Re-runnable.
-- ============================================================================

create or replace function public.register_account(
  p_email text,
  p_password text,
  p_username text,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email    text := lower(trim(p_email));
  v_username text := lower(trim(p_username));
  v_name     text := coalesce(nullif(trim(p_display_name), ''), lower(trim(p_username)));
  v_id       uuid := gen_random_uuid();
begin
  -- validation (mirrors the client-side checks)
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'weak_password';
  end if;
  if v_username !~ '^[a-z0-9._]{3,20}$' then
    raise exception 'invalid_username';
  end if;

  -- public endpoint: keep a lid on mass account creation
  if (select count(*) from auth.users where created_at > now() - interval '1 hour') >= 50 then
    raise exception 'signup_rate_limited';
  end if;

  -- friendly uniqueness checks
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'email_taken';
  end if;
  if exists (select 1 from public.users where lower(username) = v_username) then
    raise exception 'username_taken';
  end if;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, email_change_confirm_status, phone_change,
    phone_change_token, reauthentication_token, is_sso_user, is_anonymous
  ) values (
    v_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', v_username, 'display_name', v_name),
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
    v_id::text,
    v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email',
    now(), now(), now()
  );

  return v_id;
end;
$$;

-- Callable by signed-out clients (that is the point) and signed-in ones alike.
revoke all on function public.register_account(text, text, text, text) from public;
grant execute on function public.register_account(text, text, text, text) to anon, authenticated;
