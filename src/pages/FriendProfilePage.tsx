import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, MessageCircle, Play } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useStories } from "@/hooks/useStories";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Spinner";
import { StoryRing } from "@/components/ui/StoryRing";
import { STATUS_META } from "@/components/ui/StatusMenu";
import { BottomNav } from "@/components/layout/BottomNav";
import { fallbackAvatar } from "@/lib/avatars";
import { isVideoUrl } from "@/lib/media";
import { toPresenceStatus } from "@/lib/presence";
import { relativeTime } from "@/lib/utils";
import type { UserRow } from "@/types/database";

type PublicUser = Pick<
  UserRow,
  "id" | "username" | "display_name" | "avatar_url" | "bio" | "status" | "created_at"
>;

const latestOf = <T,>(items: T[]) => items[items.length - 1];

/**
 * A friend's profile: identity + presence, bio, their active status (with
 * thumbnails that open the viewer) and a shortcut into the direct chat.
 * Reached by tapping a friend's avatar or name on status/chat cards.
 */
export default function FriendProfilePage() {
  const { userId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { groups, loading: storiesLoading } = useStories();

  const [person, setPerson] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (user && userId === user.id) {
      navigate("/profile", { replace: true });
    }
  }, [navigate, user, userId]);

  useEffect(() => {
    if (!userId || (user && userId === user.id)) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url, bio, status, created_at")
        .eq("id", userId)
        .maybeSingle();
      if (!alive) return;
      setPerson(data);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [userId, user]);

  // live presence / profile edits
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`friend-profile-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users", filter: `id=eq.${userId}` },
        ({ new: row }) => {
          const update = row as PublicUser;
          setPerson((prev) => (prev && prev.id === update.id ? { ...prev, ...update } : prev));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const group = groups.find((g) => g.user.id === userId) ?? null;
  const latest = group ? latestOf(group.stories) : null;
  const name = person ? person.display_name || person.username : "Profile";
  const presence = toPresenceStatus(person?.status);

  async function message() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const { data, error } = await supabase.rpc("start_direct_chat", { other: userId });
    setBusy(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    navigate(`/messages/${data}`);
  }

  const back = (
    <button
      type="button"
      onClick={() => navigate(-1)}
      aria-label="Back"
      className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink/80 shadow-[0_10px_24px_-20px_rgba(16,17,20,0.5)] transition active:scale-95"
    >
      <ArrowLeft size={19} />
    </button>
  );

  if (loading) {
    return (
      <PhoneFrame>
        <div className="grid flex-1 place-items-center">
          <Spinner tone="dark" />
        </div>
      </PhoneFrame>
    );
  }

  if (!person) {
    return (
      <PhoneFrame>
        <header className="safe-top flex items-center gap-3 px-4 pb-2">
          {back}
          <p className="text-sm font-semibold">Profile</p>
        </header>
        <div className="grid flex-1 place-items-center px-8 text-center">
          <div>
            <p className="text-sm font-medium">This person isn’t on hi.</p>
            <p className="mt-1 text-xs text-muted">The profile may have been removed.</p>
            <button
              type="button"
              onClick={() => navigate("/messages")}
              className="mt-5 rounded-pill bg-strong px-5 py-2.5 text-sm font-semibold text-strong-fg"
            >
              Back to messages
            </button>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  const openStories = () => navigate(`/stories/${person.id}`);

  return (
    <PhoneFrame>
      <div className="flex flex-1 flex-col overflow-y-auto pb-28">
        <header className="safe-top flex items-center gap-3 px-4 pb-2">
          {back}
          <p className="text-sm font-semibold">Profile</p>
        </header>

        <div className="flex flex-col items-center px-6 pt-4 text-center">
          <button
            type="button"
            onClick={openStories}
            disabled={!group}
            aria-label={group ? `Watch ${name}'s status` : `${name} has no active status`}
            className="relative rounded-full transition enabled:active:scale-95 disabled:cursor-default"
          >
            <Avatar
              src={person.avatar_url || fallbackAvatar(person.id)}
              name={name}
              seed={person.id}
              size={96}
              className="ring-4 ring-surface"
            />
            {group && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-pill bg-accent px-2.5 py-0.5 text-[10.5px] font-semibold text-white shadow-[0_8px_18px_-6px_rgba(30,123,255,0.7)]">
                {group.stories.length} {group.stories.length === 1 ? "update" : "updates"}
              </span>
            )}
          </button>

          <h1 className="mt-5 text-[22px] font-semibold tracking-tight">{name}</h1>
          <p className="text-[13px] text-muted">@{person.username}</p>

          <span className="mt-3 inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-ink/80">
            <span className={`size-2 rounded-full ${STATUS_META[presence].dot}`} />
            {STATUS_META[presence].label}
          </span>

          {person.bio && (
            <p className="mt-4 max-w-[300px] text-[13.5px] leading-relaxed text-ink/75">{person.bio}</p>
          )}
        </div>

        <div className="mt-6 flex gap-3 px-6">
          <button
            type="button"
            onClick={() => void message()}
            disabled={busy}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-pill bg-accent text-[14px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? <Spinner className="size-4" /> : <MessageCircle size={17} />} Message
          </button>
          {group && (
            <button
              type="button"
              onClick={openStories}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-pill border border-line bg-surface text-[14px] font-medium text-ink/85 transition active:scale-[0.98]"
            >
              Watch status
            </button>
          )}
        </div>

        {notice && (
          <p className="mx-6 mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-600 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-400">
            {notice}
          </p>
        )}

        <section className="mt-7 px-6">
          <h2 className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/80">
            Status
          </h2>

          {group && latest ? (
            <div className="rounded-[26px] border border-line bg-surface p-4 shadow-[0_20px_50px_-34px_rgba(16,17,20,0.45)]">
              <div className="flex items-center gap-3">
                <StoryRing
                  viewed={group.stories.map((s) => group.viewedIds.includes(s.id))}
                  size={54}
                >
                  <Avatar
                    src={person.avatar_url || fallbackAvatar(person.id)}
                    name={name}
                    seed={person.id}
                    size={44}
                  />
                </StoryRing>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">
                    {group.stories.length} {group.stories.length === 1 ? "update" : "updates"}
                  </p>
                  <p className="text-[12px] text-muted">
                    {group.viewed ? "Watched" : "New"} · {relativeTime(latest.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openStories}
                  className="shrink-0 rounded-pill bg-strong px-4 py-2 text-[12.5px] font-semibold text-strong-fg transition active:scale-95"
                >
                  {group.viewed ? "Rewatch" : "Watch"}
                </button>
              </div>

              <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
                {group.stories.map((story) => (
                  <button
                    key={story.id}
                    type="button"
                    onClick={openStories}
                    aria-label={story.caption || "Open status"}
                    className="relative h-[92px] w-[74px] shrink-0 overflow-hidden rounded-2xl border border-line bg-surface-2"
                  >
                    {isVideoUrl(story.media_url) ? (
                      <span className="grid h-full w-full place-items-center bg-black/85 text-white">
                        <Play size={20} fill="currentColor" />
                      </span>
                    ) : (
                      <img
                        src={story.media_url ?? fallbackAvatar(person.id)}
                        alt=""
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                    )}
                    {story.caption && (
                      <>
                        <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        <span className="absolute inset-x-1.5 bottom-1.5 line-clamp-2 text-left text-[9.5px] font-medium leading-tight text-white">
                          {story.caption}
                        </span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-[26px] border border-dashed border-line bg-surface/60 px-5 py-7 text-center">
              <p className="text-[13px] font-medium">
                {storiesLoading ? "Checking for updates…" : "No active status"}
              </p>
              <p className="mt-1 text-[11.5px] text-muted">
                Status updates disappear after 24 hours.
              </p>
            </div>
          )}
        </section>

        <div className="mt-6 px-6">
          <div className="flex items-center gap-2 text-[12px] text-muted">
            <CalendarDays size={14} />
            Joined{" "}
            {new Date(person.created_at).toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>
      </div>

      <BottomNav />
    </PhoneFrame>
  );
}
