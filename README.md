# hi — Friend's Contact

A light, mobile-first chat app (390px) built with **React + Vite + TypeScript + Tailwind CSS** on **Supabase** (Auth, Postgres, Realtime, Storage, Edge Functions). The home screen puts the stories centre stage — search bar, filter chips, a horizontal status rail (blue arcs = unwatched, gray = watched) — with white chat cards below, a floating dock (Explore · camera action · Chats) and a near-black “hi” squircle brand mark.

> Enjoy the first AI-powered chat.

---

## Quick start

```bash
npm install
npm run dev -- --host
```

Open `http://localhost:5173` (or the host printed in the terminal — useful for testing from a phone on the same network).

`.env` is already configured for this project:

```env
VITE_SUPABASE_URL=https://gltugkygbapppccsurpa.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_…        # publishable key only — never the service_role key
```

(`.env.example` documents the two variables.)

### Demo account

| email          | password   | notes                         |
| -------------- | ---------- | ----------------------------- |
| `demo@hi.app`  | `demo1234` | primary account, has chats, stories and an AI conversation |
| `maya@hi.app`  | `demo1234` | chat partner, active story    |
| `leo@hi.app`   | `demo1234` | chat partner, active story    |
| `sofia@hi.app` | `demo1234` | chat partner, viewed story    |

To recreate the demo data at any time, run `supabase/seed_demo.sql`
(SQL editor → paste → Run, or `supabase db execute --file supabase/seed_demo.sql`).

> **Sign-ups:** registration is instant and needs no email round-trip. The app creates a
> confirmed account through the `register_account()` RPC (`supabase/register_account.sql`)
> and signs you straight in — this works even though the project has *Confirm email*
> enabled and its built-in mailer is rate-limited. If you prefer standard email flows
> later, disable *Confirm email* in **Dashboard → Authentication → Sign In / Providers**
> (or configure SMTP); the RPC path keeps working either way.

---

## What works

- **Stage 0 — Connect**: typed Supabase client, generated `src/types/database.ts`, `.env` setup.
- **Stage 1 — Auth**: instant email/password sign-up (username + display name) via the `register_account()` RPC — no email confirmation step, auto sign-in immediately after; plus normal sign-in, persisted sessions, protected routes and the profile row auto-created by the existing DB trigger.
- **Stage 2 — Welcome**: white “hi” squircle, two orbiting avatar rings, “Friend’s Contact”, white-to-silver **Enter** pill.
- **Stage 3 — Messages**: activity-feed home — search pill + notification bell + avatar (account/status sheet) up top, filter chips (**All Activity · Friends · Unread · AI**), a **status rail** (My status tile with ＋ badge → camera, then photo/video tiles with segmented rings — blue arcs for unwatched, gray for watched; tapping a tile opens the **story viewer** directly, while its corner profile button opens the friend's profile) and chat cards from `rpc get_chats()` (unread badges, typing line, realtime refresh), plus the floating dock (Explore pill · camera action · Chats pill). The bell toggles the Unread filter and lights up when activity (chats or statuses) is waiting. The rail sits directly at the top and has **fixed dimensions**: while statuses load it shows a skeleton frame loader of exactly the header + rail size, so the feed never shrinks or jumps as data arrives (the rail fades in place, never slides).
- **Stage 4 — Chat**: realtime `postgres_changes` on `messages` (insert + edit), optimistic sends, photo **and video** messages via the private `chat-media` bucket (members-only storage policies + signed URLs), read state via `conversation_members.last_read_at`, **typing indicator over Realtime broadcast only — never stored**, day separators, soft-delete display. The header's phone/video buttons open a **call screen** — a simulated outgoing call that **rings indefinitely** (no auto-answer, no timer) with mute/speaker toggles and, on video calls, a live local camera preview; it stays in “Calling…” / “Ringing…” until the red **End call** button is pressed. A **synthesised ringtone** loops from the moment the button is pressed until the call is ended. The composer's media button opens the gallery for **photos and clips (single or multiple)**, and a dedicated **camera button** shoots a photo or a 30s video and sends it straight into the chat. A **microphone button** records a **voice note** (tap to start, ✓ to send, ✕ to cancel, 5-minute cap) that lands in the bubble as an inline audio player; the send action uses a modern **paper-plane** icon. **Long-press (or right-click) any bubble** to open the message actions: *Delete for everyone* (your own messages — soft-deleted and removed from every member's screen live over Realtime) or *Delete for me* (hidden for your account only, remembered on your membership row). The header **⋮ menu** offers **Clear chat history** with a confirmation step — history is hidden for your account only, and `last_read_at` is reset so the chat reads as empty.
- **Stage 5 — Stories (Status)**: full in-app camera — live preview with front/back switch, shutter **photos** and **videos up to 30s** (MediaRecorder, webm/mp4 depending on the browser), gallery upload as fallback for photos **and** videos → upload to the public `stories` bucket (`<user_id>/…` enforced by storage RLS) → row insert → 24h feed (videos are recognised by their file extension — no schema change); WhatsApp-style full-screen viewer — progress bars (video progress follows playback, videos autoplay muted with a sound toggle), tap zones, press-and-hold to pause, swipe down to dismiss, auto-advance into the next person’s status (opens on the first unwatched item), view tracking in `story_views` and a view counter on your own status. **Delete your own status** from the viewer (⋮ → *Delete story* — playback pauses while the options sheet is open, then the viewer moves on) or with a **long-press on your My status rail tile** (removes all your active updates) — rows leave Supabase instantly (views cascade), the storage file is cleaned up, and the feed refreshes right away.
- **Stage 6 — hi AI**: `conversations.type = 'ai'`; the `ai-reply` Edge Function reads the history, calls an LLM, and stores the answer with `is_ai = true` through the `post_ai_reply` RPC. Reachable from Discover and Profile. If the function isn't deployed (or the key is missing), the chat **falls back to a clearly-labelled demo reply** so the flow keeps working, and the notice banner shows the exact cause.
- **Stage 7 — Calls**: a **Chats · Calls** switch at the top of the chat screen. Every call made in the app is recorded in `public.calls` and listed with direction arrows — ↗ **outgoing**, ↘ **incoming**, ↙ **missed** in red — the caller's avatar with a voice/video badge, date + time (grouped by day) and a one-tap **redial** button matching the call's type. Tapping a row opens the chat; both participants see the call (the callee's side shows it as incoming/missed), and the list updates live over Realtime.
- **Profile & Settings**: avatar upload (`avatars` bucket), display name/bio editing, sign out — and an **Appearance** switch (Settings section) that flips the entire app between **Light and Dark** instantly (choice stored in `localStorage`, applied before first paint, device setting used as the default).
- **Friend profiles**: tapping a friend’s avatar/name on a status or chat card opens `/u/:id` — their identity, presence, bio, joined date, a live view of their active status (thumbnail strip → viewer) and a one-tap **Message** shortcut into the direct chat.
- **Presence**: tapping your avatar on Messages opens the account sheet — Online / Idle / Do Not Disturb is written to `users.status` (optimistic, with rollback + an inline error if the write fails); status dots appear on the account sheet, the chat list and the chat header. `users` is in the `supabase_realtime` publication, so changes made on one device appear on the others instantly (your own row syncs in `AuthContext`, peers in `useChats` / the chat header).

### Not included (deliberately)

- Group chat creation UI (schema supports it), story replies, push notifications, contact accept/decline UI (requests can be created from Discover; accepting is a one-line update).

---

## Database

The existing schema is used as-is: `users`, `contacts`, `conversations`,
`conversation_members`, `messages`, `stories`, `story_views` (+ `is_member`,
`start_direct_chat`, `get_chats`). All changes are additive: one new table
(`calls`, call history) plus a few columns on existing tables (`users.status`,
`conversation_members.hidden_message_ids` / `cleared_at`). Nothing was dropped
or rewritten.

Additive files (already applied to this project):

| file | what it adds |
| ---- | ------------ |
| `supabase/user_status.sql` | `users.status` (`online` · `idle` · `dnd`) + check constraint — persists the account sheet's presence picker |
| `supabase/users_realtime.sql` | adds `users` to the `supabase_realtime` publication — status fans out live to all devices |
| `supabase/register_account.sql` | `register_account()` — SECURITY DEFINER account creation (validation, uniqueness checks, hourly cap) so sign-up skips the email round-trip |
| `supabase/ai_and_storage.sql` | `storage.objects` policies for `avatars`, `stories`, `chat-media` + `start_ai_chat()` + `post_ai_reply()` (SECURITY DEFINER) |
| `supabase/chat_history.sql` | `conversation_members.hidden_message_ids` + `cleared_at` — delete-for-me and clear-history, per account |
| `supabase/calls.sql` | new `calls` table + RLS + Realtime publication — call history shared by both participants |
| `supabase/seed_demo.sql` | optional demo users/chats/stories (data only) |
| `supabase/seed_calls.sql` | optional sample call history for the demo accounts (data only) |

---

## AI assistant (Edge Function)

The function lives at `supabase/functions/ai-reply/index.ts`.
The LLM key is **only** a Supabase secret — it never reaches the client, and no
service-role key is used anywhere in this project (the function acts with the
caller's JWT + RLS).

```bash
# 1. once per machine
supabase login

# 2. link the repo to the project
supabase link --project-ref gltugkygbapppccsurpa

# 3. the secret the function reads (exact name: OPENAI_API_KEY)
supabase secrets set OPENAI_API_KEY=sk-your-key-here \
  AI_MODEL=gpt-4o-mini \
  --project-ref gltugkygbapppccsurpa

# 4. deploy
supabase functions deploy ai-reply --project-ref gltugkygbapppccsurpa
```

Optional: `AI_BASE_URL` points the function at any OpenAI-compatible endpoint
(OpenRouter, Azure OpenAI, a local gateway, …).

The function refuses to run without `OPENAI_API_KEY` — but it does not go silent:
if the secret is missing it stores a labelled **demo reply** through `post_ai_reply`
so the chat keeps working. The client applies the same fallback when the function
itself is not deployed (HTTP 404), and the notice banner spells out the cause
(`the "ai-reply" function is not deployed`, `OPENAI_API_KEY secret is not set`, …).
It verifies the caller's session, checks that the conversation is an `ai` chat the
caller belongs to, keeps the last 20 messages as context and stores one reply via
`post_ai_reply`. Sending a photo/video in an AI chat pings the assistant too —
the model is text-only, so with a real key it may simply skip; offline you always
get a labelled demo reply.

---

## Project structure

```
src/
  components/
    CameraCapture.tsx     full-screen camera (photos + 30s videos, front/back)
    CallOverlay.tsx       simulated voice/video call screen (continuous ringing, mute, self-view)
    CallsList.tsx         call history list (direction arrows, redial, live updates)
    ChatImage.tsx         signed-URL image, video player and voice-note player for private chat media
    PeopleSearch.tsx      username search with inline results
    StoryComposer.tsx     status composer (preview photo/video, caption, upload)
    layout/BottomNav.tsx  floating dock (Explore · camera action · Chats)
    ui/                   Avatar · Logo · PhoneFrame · Spinner · FloatingSheet · StatusMenu · StoryRing
  context/AuthContext.tsx session + profile (+ updateStatus)
  context/ThemeContext.tsx light/dark theme — .dark class, persisted, system default
  hooks/                 useChats · useStories · useTyping · useLongPress · useCalls · useSimulatedCall · useAudioRecorder
  lib/                   supabase client · utils · avatar fallbacks · presence · ringtone · ai reply fallback · media + story helpers
  pages/                 Welcome · Auth · Messages · Chat · Camera(status camera) · Discover · Profile · FriendProfile · StoryViewer
  types/database.ts      generated from the live schema (tables + RPCs + FK relationships)
supabase/
  user_status.sql        users.status column (additive)
  chat_history.sql       hidden_message_ids + cleared_at on conversation_members (additive)
  users_realtime.sql     users in the supabase_realtime publication
  register_account.sql   instant sign-up RPC (SECURITY DEFINER)
  ai_and_storage.sql     storage policies + AI RPCs
  calls.sql              calls table + RLS + Realtime (additive)
  seed_demo.sql          demo data
  seed_calls.sql         sample call history (data only)
  functions/ai-reply/    Edge Function
  config.toml
```

**Theming** — every UI color is a semantic Tailwind token (`canvas`, `surface`,
`surface-2`, `ink`, `muted`, `line`, `accent`, plus `strong` / `strong-fg` for
inverted buttons) backed by CSS variables in `src/index.css`. Adding `.dark`
to `<html>` swaps the variable set, so the whole app flips without per-component
overrides; the story viewer, camera and call screen stay intentionally dark in both themes.

---

## Scripts

```bash
npm run dev        # dev server
npm run build      # typecheck + production build
npm run preview    # preview the build
npm run typecheck  # types only
```

---

## Troubleshooting

- **Sign-up says “email rate limit exceeded”** — the app's sign-up never sends email (it uses the `register_account` RPC); this error only appears when calling `supabase.auth.signUp` directly. Use the in-app form, or disable *Confirm email* in the dashboard.
- **Sign-in says “Invalid login credentials”** — check the password; the demo uses `demo1234`.
- **hi AI replies with “demo reply”** — expected: the `ai-reply` function isn't deployed or `OPENAI_API_KEY` isn't set. The notice banner shows the exact cause (e.g. `the "ai-reply" function is not deployed`); deploy with the commands above to get real answers.
- **Realtime doesn't push [on very old clients]** — wait a second after opening a screen; subscriptions arm asynchronously (initial content is fetched over REST regardless).
- **Non-x86/ARM platforms (e.g. Termux)** — `package.json` pins Rollup to the WASM build (`overrides.rollup`) so the toolchain runs without native binaries; Vite is pinned to v7 and Tailwind to v3 for the same reason.
