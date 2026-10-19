import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, ChevronRight, Clock, Plus, Trash2, UserRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useChats } from "@/hooks/useChats";
import { useStories, type StoryGroup } from "@/hooks/useStories";
import { useTypingChannel } from "@/hooks/useTyping";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/ui/Logo";
import { StoryRing } from "@/components/ui/StoryRing";
import { StatusDot, StatusMenu } from "@/components/ui/StatusMenu";
import { BottomNav } from "@/components/layout/BottomNav";
import { PeopleSearch } from "@/components/PeopleSearch";
import { CallsList } from "@/components/CallsList";
import { CameraCapture, type Capture } from "@/components/CameraCapture";
import { StoryComposer } from "@/components/StoryComposer";
import { Spinner } from "@/components/ui/Spinner";
import { fallbackAvatar } from "@/lib/avatars";
import { isVideoUrl } from "@/lib/media";
import { deleteStories } from "@/lib/stories";
import { toPresenceStatus, type PresenceStatus } from "@/lib/presence";
import { cn, relativeTime } from "@/lib/utils";

type FeedFilter = "all" | "friends" | "unread" | "ai";

const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "All Activity" },
  { id: "friends", label: "Friends" },
  { id: "unread", label: "Unread" },
  { id: "ai", label: "AI" },
];

type HomeView = "chats" | "calls";

const HOME_VIEWS: { id: HomeView; label: string }[] = [
  { id: "chats", label: "Chats" },
  { id: "calls", label: "Calls" },
];

const CARD =
  "rounded-[26px] border border-line bg-surface p-3 shadow-[0_20px_50px_-34px_rgba(16,17,20,0.5)]";

const latestOf = (g: StoryGroup) => g.stories[g.stories.length - 1];
const latestTime = (g: StoryGroup) => +new Date(latestOf(g).created_at);

/**
 * Home feed: search + bell + avatar up top, filter chips, then the status
 * rail (My status + friends' rings) with chat activity cards below.
 */
export default function MessagesPage() {
  const navigate = useNavigate();
  const { profile, user, updateStatus, signOut } = useAuth();
  const { chats, loading, error } = useChats();
  const { groups, loading: storiesLoading, reload: reloadStories } = useStories();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [mySheetOpen, setMySheetOpen] = useState(false);
  const [myDeleting, setMyDeleting] = useState(false);
  const [myDeleteError, setMyDeleteError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [view, setView] = useState<HomeView>("chats");
  const [typing, setTyping] = useState<Record<string, { name: string; expires: number }>>({});

  useTypingChannel(user?.id, (t) => {
    setTyping((prev) => ({
      ...prev,
      [t.conversation_id]: { name: t.name, expires: Date.now() + 3200 },
    }));
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      setTyping((prev) => {
        const now = Date.now();
        const next: typeof prev = {};
        let changed = false;
        for (const [key, value] of Object.entries(prev)) {
          if (value.expires > now) next[key] = value;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    document.title = "Messages · hi";
  }, []);

  useEffect(() => {
    if (!statusError) return;
    const id = window.setTimeout(() => setStatusError(null), 4000);
    return () => window.clearTimeout(id);
  }, [statusError]);

  async function handleStatusChange(next: PresenceStatus) {
    setStatusError(null);
    const message = await updateStatus(next);
    if (message) setStatusError(message);
  }

  const unreadChats = chats.filter((c) => c.unread_count > 0).length;

  const ownGroup = groups.find((g) => g.isOwn) ?? null;
  const statusGroups = groups.filter((g) => !g.isOwn);
  const recentGroups = statusGroups.filter((g) => !g.viewed).sort((a, b) => latestTime(b) - latestTime(a));
  const viewedGroups = statusGroups.filter((g) => g.viewed).sort((a, b) => latestTime(b) - latestTime(a));

  // the rail: unwatched first (newest first), then watched — plus your tile
  const railGroups = filter === "unread" ? recentGroups : [...recentGroups, ...viewedGroups];
  const statusVisible =
    !storiesLoading && filter !== "ai" && (filter !== "unread" || recentGroups.length > 0);
  const hasUnreadActivity = unreadChats > 0 || recentGroups.length > 0;

  const visibleChats = useMemo(() => {
    switch (filter) {
      case "friends":
        return chats.filter((c) => c.chat_type !== "ai");
      case "unread":
        return chats.filter((c) => c.unread_count > 0);
      case "ai":
        return chats.filter((c) => c.chat_type === "ai");
      default:
        return chats;
    }
  }, [chats, filter]);

  const nothingToShow =
    !loading &&
    !error &&
    !storiesLoading &&
    visibleChats.length === 0 &&
    (filter === "all" ? statusGroups.length === 0 : filter === "unread" ? recentGroups.length === 0 : true);
  const brandNew = chats.length === 0 && groups.length === 0 && filter === "all";

  const openOwnStatus = () => {
    if (ownGroup) navigate(`/stories/${ownGroup.user.id}`);
    else setCameraOpen(true);
  };

  async function deleteMyStatus() {
    if (!ownGroup || myDeleting) return;
    setMyDeleting(true);
    setMyDeleteError(null);
    const error = await deleteStories(ownGroup.stories);
    if (error) {
      setMyDeleteError(error);
      setMyDeleting(false);
      return;
    }
    setMyDeleting(false);
    setMySheetOpen(false);
    void reloadStories();
  }

  return (
    <PhoneFrame>
      <div className="flex flex-1 flex-col overflow-y-auto pb-32">
        <header className="safe-top px-5">
          <div className="flex items-center gap-2.5">
            <PeopleSearch />
            <button
              type="button"
              onClick={() => setFilter((f) => (f === "unread" ? "all" : "unread"))}
              aria-label="Show unread activity"
              aria-pressed={filter === "unread"}
              className={cn(
                "relative grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink/75 shadow-[0_14px_30px_-22px_rgba(16,17,20,0.6)] transition active:scale-95",
                filter === "unread" && "border-accent/40 text-accent"
              )}
            >
              <Bell size={18} />
              {hasUnreadActivity && (
                <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-accent ring-2 ring-surface" />
              )}
            </button>
            <StatusMenu
              status={toPresenceStatus(profile?.status)}
              onStatusChange={(next) => void handleStatusChange(next)}
              name={profile?.display_name || profile?.username || "Me"}
              username={profile?.username}
              avatarUrl={profile?.avatar_url}
              seed={profile?.id}
              error={statusError}
              onProfile={() => navigate("/profile")}
              onSignOut={() => {
                void signOut().then(() => navigate("/welcome", { replace: true }));
              }}
            />
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-1 rounded-pill border border-line bg-surface p-1 shadow-[0_14px_30px_-24px_rgba(16,17,20,0.6)]">
            {HOME_VIEWS.map((v) => {
              const active = view === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  aria-pressed={active}
                  className={cn(
                    "h-9 rounded-pill text-[12.5px] font-semibold transition active:scale-[0.98]",
                    active
                      ? "bg-strong text-strong-fg shadow-[0_14px_28px_-16px_rgba(11,11,12,0.8)]"
                      : "text-ink/60"
                  )}
                >
                  {v.label}
                </button>
              );
            })}
          </div>

          {view === "chats" && (
          <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={active}
                  className={cn(
                    "h-9 shrink-0 rounded-pill px-4 text-[12.5px] font-semibold transition active:scale-[0.97]",
                    active
                      ? "bg-strong text-strong-fg shadow-[0_14px_28px_-16px_rgba(11,11,12,0.8)]"
                      : "border border-line bg-surface text-ink/65 shadow-[0_10px_24px_-20px_rgba(16,17,20,0.55)]"
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          )}
        </header>

        <div className="space-y-6 px-5 pt-3">
          {view === "calls" ? (
            <CallsList />
          ) : (
            <>
          {/* Status rail: always first and always the same height — while the
              stories load it is a frame loader of exactly these dimensions. */}
          {filter !== "ai" &&
            (storiesLoading ? (
              <StoryStageSkeleton />
            ) : (
              statusVisible && (
                <section className="space-y-3.5">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/80">
                      Status
                    </h2>
                    <button
                      type="button"
                      onClick={() => setCameraOpen(true)}
                      aria-label="Add to status"
                      className="grid size-7 place-items-center rounded-full border border-line bg-surface text-ink/75 shadow-[0_10px_24px_-18px_rgba(16,17,20,0.55)] transition active:scale-95"
                    >
                      <Plus size={15} />
                    </button>
                  </div>

                  <div className="no-scrollbar -mx-5 flex animate-fade-in gap-3 overflow-x-auto px-5 pb-1">
                    {filter !== "unread" && (
                      <MyStatusTile
                        group={ownGroup}
                        onOpen={openOwnStatus}
                        onAdd={() => setCameraOpen(true)}
                        onLongPress={
                          ownGroup
                            ? () => {
                                setMyDeleteError(null);
                                setMySheetOpen(true);
                              }
                            : undefined
                        }
                      />
                    )}
                    {railGroups.map((g) => (
                      <StatusTile
                        key={g.user.id}
                        group={g}
                        onOpen={() => navigate(`/stories/${g.user.id}`)}
                        onProfile={() => navigate(`/u/${g.user.id}`)}
                      />
                    ))}
                  </div>
                </section>
              )
            ))}

          {loading && (
            <div className="space-y-3.5">
              {[0, 1].map((i) => (
                <div key={i} className={cn(CARD, "h-[168px] animate-pulse bg-surface/70")} />
              ))}
            </div>
          )}

          {!loading && error && (
            <p className="rounded-[26px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </p>
          )}

          {!loading && !error && visibleChats.length > 0 && (
            <section className="space-y-3.5">
              <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/80">
                Messages
              </h2>
              {visibleChats.map((chat) => {
                const isAi = chat.chat_type === "ai";
                const peer = chat.peer;
                const typingInfo = typing[chat.chat_id];
                const name = isAi
                  ? chat.title || "hi AI"
                  : peer
                    ? peer.display_name || peer.username
                    : chat.title || "Chat";
                return (
                  <div
                    key={chat.chat_id}
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/messages/${chat.chat_id}`)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter") {
                        e.preventDefault();
                        navigate(`/messages/${chat.chat_id}`);
                      }
                    }}
                    className={cn(CARD, "block cursor-pointer transition active:scale-[0.99]")}
                  >
                    <div className="flex items-center justify-between gap-3 px-1">
                      <span
                        className={cn(
                          "shrink-0 rounded-pill px-3 py-1 text-[11px] font-semibold",
                          isAi ? "bg-accent/10 text-accent" : "bg-surface-2 text-ink/70"
                        )}
                      >
                        {isAi ? "AI Assistant" : "Friend Activity"}
                      </span>
                      {peer ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/u/${peer.id}`);
                          }}
                          aria-label={`Open ${name}'s profile`}
                          className="flex min-w-0 items-center gap-1.5 rounded-pill py-0.5 pl-0.5 pr-1.5 transition hover:bg-surface-2 active:scale-[0.97]"
                        >
                          <span className="relative shrink-0">
                            <Avatar
                              src={peer.avatar_url || fallbackAvatar(peer.id)}
                              name={name}
                              seed={peer.id}
                              size={22}
                            />
                            <StatusDot
                              status={toPresenceStatus(peer.status)}
                              size={10}
                              halo={false}
                              className="absolute -bottom-0.5 -right-0.5"
                            />
                          </span>
                          <span className="truncate text-[12px] font-medium text-ink/80">{name}</span>
                        </button>
                      ) : (
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Logo size={22} className="shrink-0" />
                          <span className="truncate text-[12px] font-medium text-ink/80">{name}</span>
                        </span>
                      )}
                    </div>

                    <h3 className="truncate px-1 pt-2 text-[15px] font-semibold leading-snug">{name}</h3>
                    <p
                      className={cn(
                        "truncate px-1 pt-0.5 text-[12.5px]",
                        typingInfo ? "text-accent" : "text-muted"
                      )}
                    >
                      {typingInfo
                        ? `${typingInfo.name.split(" ")[0]} is typing…`
                        : chat.last_message || "Say hello 👋"}
                    </p>

                    <div className="flex items-center justify-between px-1 pt-2.5">
                      <span className="rounded-pill bg-strong px-4 py-2 text-[12.5px] font-semibold text-strong-fg">
                        Open Chat
                      </span>
                      <span className="flex items-center gap-1 text-[11.5px] text-muted">
                        <Clock size={12} /> {relativeTime(chat.last_message_at)}
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between border-t border-line/70 px-1 pt-2">
                      {chat.unread_count > 0 ? (
                        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-accent">
                          <span className="size-2 rounded-full bg-accent" />
                          {chat.unread_count > 99 ? "99+" : chat.unread_count} new{" "}
                          {chat.unread_count === 1 ? "message" : "messages"}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
                          <Check size={13} /> Up to date
                        </span>
                      )}
                      <ChevronRight size={15} className="text-muted/60" />
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {nothingToShow && (
            <div className="rounded-[26px] border border-line bg-surface/70 px-6 py-12 text-center shadow-[0_20px_50px_-40px_rgba(16,17,20,0.5)]">
              <p className="text-sm font-semibold">
                {brandNew ? "Nothing here yet" : "Nothing here right now"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {brandNew
                  ? "Search anyone above to say hi — add friends in Discover and their status updates land here."
                  : "Try another filter — or start something new."}
              </p>
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {mySheetOpen && ownGroup && (
        <div
          className="fixed inset-0 z-[65] flex justify-center bg-black/30"
          onClick={() => {
            if (!myDeleting) setMySheetOpen(false);
          }}
        >
          <div
            className="mt-auto w-full max-w-[390px] px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-[26px] border border-line bg-surface p-5 shadow-[0_30px_80px_-30px_rgba(16,17,20,0.55)]">
              <p className="text-[15px] font-semibold">Delete your status?</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                {ownGroup.stories.length} {ownGroup.stories.length === 1 ? "update" : "updates"} will be
                removed for everyone right away.
              </p>
              {myDeleteError && <p className="mt-2 text-[12px] text-red-600">{myDeleteError}</p>}
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setMySheetOpen(false)}
                  disabled={myDeleting}
                  className="h-12 flex-1 rounded-pill border border-line bg-surface text-[14px] font-medium text-ink/85 transition active:scale-[0.98] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void deleteMyStatus()}
                  disabled={myDeleting}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-pill bg-red-600 text-[14px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
                >
                  {myDeleting ? <Spinner /> : <Trash2 size={16} />} Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(next) => {
          setCapture(next);
          setCameraOpen(false);
          setComposerOpen(true);
        }}
        onUpload={() => {
          setCameraOpen(false);
          setComposerOpen(true);
        }}
      />
      <StoryComposer
        open={composerOpen}
        capture={capture}
        onClose={() => {
          setComposerOpen(false);
          setCapture(null);
        }}
        onShared={() => void reloadStories()}
        onRetake={() => {
          setComposerOpen(false);
          setCapture(null);
          setCameraOpen(true);
        }}
        onOpenCamera={() => {
          setComposerOpen(false);
          setCameraOpen(true);
        }}
      />
      <BottomNav onCamera={() => setCameraOpen(true)} />
    </PhoneFrame>
  );
}

/**
 * Frame loader for the status rail. It mirrors the real layout 1:1 — header
 * row (28px) and the 136px rail — so the feed never jumps while stories are
 * fetched: the rail is present (in skeleton form) from the very first paint
 * and simply swaps its content in place.
 */
function StoryStageSkeleton() {
  return (
    <section className="space-y-3.5" aria-hidden>
      <div className="flex items-center justify-between px-1">
        <div className="h-[13px] w-16 animate-pulse rounded-full bg-surface" />
        <div className="size-7 animate-pulse rounded-full bg-surface" />
      </div>
      <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[136px] w-[100px] shrink-0 animate-pulse rounded-[22px] bg-surface"
          />
        ))}
      </div>
    </section>
  );
}

/** One tile of the ring rail: photo cover, segmented ring avatar, name + time. */
function StatusTile({
  group,
  onOpen,
  onProfile,
}: {
  group: StoryGroup;
  onOpen: () => void;
  onProfile: () => void;
}) {
  const latest = latestOf(group);
  if (!latest) return null;
  const name = group.user.display_name || group.user.username;
  return (
    <div className="relative h-[136px] w-[100px] shrink-0">
      {/*
        The whole tile opens the Story Viewer; the profile is reached through
        the dedicated button below, so a tap anywhere on the story can never
        land on the profile by accident.
      */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Watch ${name}'s status`}
        className="relative h-full w-full select-none overflow-hidden rounded-[22px] text-left shadow-[0_18px_36px_-24px_rgba(16,17,20,0.55)] transition active:scale-[0.97]"
      >
        <StoryMedia
          url={latest.media_url}
          fallback={fallbackAvatar(group.user.id)}
          className="h-full w-full"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/5" />
        <span className="absolute left-2 top-2">
          <StoryRing viewed={group.stories.map((s) => group.viewedIds.includes(s.id))} size={40}>
            <Avatar
              src={group.user.avatar_url || fallbackAvatar(group.user.id)}
              name={name}
              seed={group.user.id}
              size={31}
            />
          </StoryRing>
        </span>
        <span className="absolute inset-x-0 bottom-0 block p-2.5">
          <span className="block truncate text-[11.5px] font-semibold text-white">{name}</span>
          <span className="block text-[10.5px] text-white/75">
            {group.stories.length} {group.stories.length === 1 ? "update" : "updates"} ·{" "}
            {relativeTime(latest.created_at)}
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onProfile();
        }}
        aria-label={`Open ${name}'s profile`}
        title={`${name}'s profile`}
        className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/55 active:scale-90"
      >
        <UserRound size={14} />
      </button>
    </div>
  );
}

/** First tile of the rail: your own status, or a prompt to add one. */
function MyStatusTile({
  group,
  onOpen,
  onAdd,
  onLongPress,
}: {
  group: StoryGroup | null;
  onOpen: () => void;
  onAdd: () => void;
  onLongPress?: () => void;
}) {
  const latest = group ? latestOf(group) : null;
  const pressTimer = useRef<number | undefined>(undefined);
  const pressedLong = useRef(false);

  function startPress() {
    if (!onLongPress) return;
    pressedLong.current = false;
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      pressedLong.current = true;
      onLongPress();
    }, 500);
  }

  function stopPress() {
    window.clearTimeout(pressTimer.current);
  }

  return (
    <div className="relative h-[136px] w-[100px] shrink-0">
      <button
        type="button"
        onClick={() => {
          if (pressedLong.current) {
            pressedLong.current = false;
            return;
          }
          onOpen();
        }}
        onPointerDown={(e) => {
          if (e.button === 0) startPress();
        }}
        onPointerUp={stopPress}
        onPointerLeave={stopPress}
        onPointerCancel={stopPress}
        onContextMenu={(e) => {
          if (onLongPress) e.preventDefault();
        }}
        aria-label={onLongPress ? "My status — hold to delete" : "My status"}
        className="relative h-full w-full select-none overflow-hidden rounded-[22px] text-left shadow-[0_18px_36px_-24px_rgba(16,17,20,0.55)] transition active:scale-[0.97]"
      >
        {group && latest ? (
          <>
            <StoryMedia
              url={latest.media_url}
              fallback={fallbackAvatar(group.user.id)}
              className="h-full w-full"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/5" />
          </>
        ) : (
          <>
            <span className="absolute inset-0 rounded-[22px] border border-dashed border-line bg-surface" />
            <span className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2">
              <span className="grid size-10 place-items-center rounded-full bg-accent text-white shadow-[0_10px_22px_-10px_rgba(30,123,255,0.85)]">
                <Plus size={17} strokeWidth={2.8} />
              </span>
            </span>
          </>
        )}
        <span className={cn("absolute inset-x-0 bottom-0 block p-2.5", group && latest && "pr-9")}>
          <span
            className={cn(
              "block truncate text-[11.5px] font-semibold",
              group && latest ? "text-white" : "text-ink/85"
            )}
          >
            My status
          </span>
          <span
            className={cn(
              "block truncate text-[10.5px]",
              group && latest ? "text-white/75" : "text-muted"
            )}
          >
            {group && latest ? relativeTime(latest.created_at) : "Add an update"}
          </span>
        </span>
      </button>
      {group && latest && (
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add to status"
          className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-white/95 text-ink shadow-[0_10px_20px_-10px_rgba(16,17,20,0.6)] transition active:scale-90"
        >
          <Plus size={15} strokeWidth={2.8} />
        </button>
      )}
    </div>
  );
}

/** Cover art for a status: plays videos inline (muted), shows photos as-is. */
function StoryMedia({
  url,
  fallback,
  className,
}: {
  url?: string | null;
  fallback: string;
  className?: string;
}) {
  const src = url ?? fallback;
  if (isVideoUrl(url)) {
    return (
      <video
        src={src}
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
        className={cn("pointer-events-none object-cover", className)}
      />
    );
  }
  return <img src={src} alt="" draggable={false} className={cn("object-cover", className)} />;
}
