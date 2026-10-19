import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Eye, MoreVertical, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Spinner";
import { fallbackAvatar } from "@/lib/avatars";
import { isVideoUrl } from "@/lib/media";
import { deleteStories } from "@/lib/stories";
import { relativeTime } from "@/lib/utils";
import { markStoryViewed, useStories, type StoryGroup } from "@/hooks/useStories";

const HOLD_MS = 220; // press-and-hold before playback pauses
const DRAG_CLOSE = 110; // px dragged down that dismisses the viewer

const latestOf = (g: StoryGroup) => g.stories[g.stories.length - 1];

/**
 * WhatsApp-style status viewer: tap left/right to move, hold to pause,
 * swipe down to close, and playback rolls into the next person's status.
 * Photos run for 5s; videos play through (muted until you tap the sound).
 * Your own status gets a ⋮ menu with delete (playback pauses to confirm).
 */
export default function StoryViewerPage() {
  const { userId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { groups, loading: feedLoading, reload } = useStories();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [pausedByHold, setPausedByHold] = useState(false);
  const [moving, setMoving] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [muted, setMuted] = useState(true);
  const [videoPct, setVideoPct] = useState(0);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const seenThisSession = useRef<Set<string>>(new Set());
  const press = useRef<{ x: number; y: number; t: number; dragging: boolean } | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const dragYRef = useRef(0);
  const bootRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const activeGroup = activeId ? (groups.find((g) => g.user.id === activeId) ?? null) : null;
  const activeStories = useMemo(
    () => (activeGroup ? activeGroup.stories.filter((s) => !deletedIds.has(s.id)) : []),
    [activeGroup, deletedIds]
  );
  const current = activeStories[index];
  const isOwn = activeGroup?.isOwn ?? false;
  const name = activeGroup ? activeGroup.user.display_name || activeGroup.user.username : "Status";
  const mediaIsVideo = isVideoUrl(current?.media_url);

  const firstUnseen = useCallback(
    (id: string) => {
      const g = groups.find((x) => x.user.id === id);
      if (!g) return 0;
      const seen = new Set([...g.viewedIds, ...seenThisSession.current]);
      const i = g.stories.findIndex((s) => !seen.has(s.id));
      return i === -1 ? 0 : i;
    },
    [groups]
  );

  // open on the first status this viewer hasn't watched yet
  useEffect(() => {
    if (bootRef.current || feedLoading) return;
    if (!groups.some((g) => g.user.id === userId)) return;
    bootRef.current = true;
    setActiveId(userId);
    setIndex(firstUnseen(userId));
  }, [feedLoading, firstUnseen, groups, userId]);

  // swipe order: people with unwatched updates first, then the rest — newest first
  const chain = useMemo(() => {
    return groups
      .filter((g) => !g.isOwn)
      .slice()
      .sort((a, b) => {
        const av = a.viewed ? 1 : 0;
        const bv = b.viewed ? 1 : 0;
        if (av !== bv) return av - bv;
        return +new Date(latestOf(b).created_at) - +new Date(latestOf(a).created_at);
      })
      .map((g) => g.user.id);
  }, [groups]);

  const close = useCallback(() => navigate(-1), [navigate]);

  const enterUser = useCallback(
    (id: string, back: boolean) => {
      const g = groups.find((x) => x.user.id === id);
      if (!g) return;
      setActiveId(id);
      setIndex(back ? g.stories.length - 1 : firstUnseen(id));
      setPausedByHold(false);
      dragYRef.current = 0;
      setDragY(0);
      setMoving(false);
    },
    [firstUnseen, groups]
  );

  const advance = useCallback(() => {
    if (!activeGroup) return;
    if (index < activeStories.length - 1) {
      setIndex(index + 1);
      return;
    }
    const pos = activeId ? chain.indexOf(activeId) : -1;
    if (pos >= 0 && pos + 1 < chain.length) {
      enterUser(chain[pos + 1], false);
      return;
    }
    if (pos === -1 && chain.length > 0) {
      enterUser(chain[0], false);
      return;
    }
    close();
  }, [activeGroup, activeId, activeStories, chain, close, enterUser, index]);

  const back = useCallback(() => {
    if (!activeGroup) return;
    if (index > 0) {
      setIndex(index - 1);
      return;
    }
    const pos = activeId ? chain.indexOf(activeId) : -1;
    if (pos > 0) {
      enterUser(chain[pos - 1], true);
      return;
    }
    setIndex(0);
  }, [activeGroup, activeId, chain, enterUser, index]);

  // track the view once per story, skip your own
  useEffect(() => {
    if (current && user && current.user_id !== user.id) {
      seenThisSession.current.add(current.id);
      void markStoryViewed(current.id, user.id);
    }
  }, [current, user]);

  // view counter for your own status
  useEffect(() => {
    const g = groups.find((x) => x.user.id === activeId);
    if (!g?.isOwn) {
      setViewCounts({});
      return;
    }
    let alive = true;
    void supabase
      .from("story_views")
      .select("story_id")
      .in("story_id", g.stories.map((s) => s.id))
      .then(({ data }) => {
        if (!alive) return;
        const counts: Record<string, number> = {};
        for (const row of (data ?? []) as { story_id: string }[]) {
          counts[row.story_id] = (counts[row.story_id] ?? 0) + 1;
        }
        setViewCounts(counts);
      });
    return () => {
      alive = false;
    };
  }, [activeId, groups]);

  // video playback follows the pause state (hold-to-pause, drag, confirm sheet)
  const paused = pausedByHold || (moving && dragY > 0) || optionsOpen;
  useEffect(() => {
    setVideoPct(0);
  }, [current?.id]);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = muted;
    if (paused) el.pause();
    else void el.play().catch(() => {});
  }, [paused, muted, current?.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (optionsOpen) setOptionsOpen(false);
        else close();
      } else if (e.key === "ArrowRight") advance();
      else if (e.key === "ArrowLeft") back();
      else if (e.key === " ") {
        e.preventDefault();
        setPausedByHold((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, back, close, optionsOpen]);

  async function deleteCurrent() {
    if (!current || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    const error = await deleteStories([current]);
    if (error) {
      setDeleteError(error);
      setDeleting(false);
      return;
    }
    const remaining = activeStories.filter((s) => s.id !== current.id);
    setDeletedIds((prev) => new Set(prev).add(current.id));
    setDeleting(false);
    setOptionsOpen(false);
    if (remaining.length > 0) {
      setIndex(Math.min(index, remaining.length - 1));
    } else {
      const pos = activeId ? chain.indexOf(activeId) : -1;
      if (pos >= 0 && pos + 1 < chain.length) enterUser(chain[pos + 1], false);
      else if (pos === -1 && chain.length > 0) enterUser(chain[0], false);
      else close();
    }
    void reload();
  }

  function releasePress() {
    press.current = null;
    window.clearTimeout(holdTimer.current);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    press.current = { x: e.clientX, y: e.clientY, t: Date.now(), dragging: false };
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      if (press.current && !press.current.dragging) setPausedByHold(true);
    }, HOLD_MS);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const p = press.current;
    if (!p) return;
    const dy = e.clientY - p.y;
    const dx = e.clientX - p.x;
    if (!p.dragging && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
      p.dragging = true;
      window.clearTimeout(holdTimer.current);
      setMoving(true);
    }
    if (p.dragging) {
      const d = Math.max(0, dy);
      dragYRef.current = d;
      setDragY(d);
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const p = press.current;
    releasePress();
    setPausedByHold(false);
    if (!p) return;
    if (p.dragging) {
      setMoving(false);
      if (dragYRef.current > DRAG_CLOSE) {
        close();
        return;
      }
      dragYRef.current = 0;
      setDragY(0);
      return;
    }
    if (Date.now() - p.t > 300) return; // long press = pause, not a tap
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / (rect.width || window.innerWidth);
    if (ratio < 0.35) back();
    else if (ratio > 0.65) advance();
  }

  function onPointerCancel() {
    releasePress();
    setPausedByHold(false);
    setMoving(false);
    dragYRef.current = 0;
    setDragY(0);
  }

  const booting = !feedLoading && !activeId && groups.some((g) => g.user.id === userId);

  if (feedLoading || booting) {
    return (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-black">
        <Spinner />
      </div>
    );
  }

  if (!activeGroup || !current) {
    return (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-black px-8 text-center">
        <div className="text-white">
          <p className="text-sm font-medium">No active status</p>
          <p className="mt-1 text-xs text-white/60">Status updates disappear after 24 hours.</p>
          <button
            type="button"
            onClick={close}
            className="mt-5 rounded-pill bg-white px-5 py-2.5 text-sm font-semibold text-black"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const dim = Math.max(0, 1 - dragY / 420);

  return (
    <div
      role="dialog"
      aria-label="Status"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className="fixed inset-0 z-[60] touch-none select-none"
      style={{ background: `rgba(0,0,0,${dim})` }}
    >
      <div
        className="relative mx-auto h-full w-full max-w-[390px] overflow-hidden bg-black"
        style={{
          transform: `translateY(${dragY}px) scale(${Math.max(0.86, 1 - dragY / 1600)})`,
          borderRadius: dragY > 0 ? 18 : 0,
          transition: moving ? "none" : "transform 0.25s cubic-bezier(0.22,1,0.36,1), border-radius 0.25s ease",
        }}
      >
        {mediaIsVideo ? (
          <video
            key={`${activeId}-${current.id}`}
            ref={videoRef}
            src={current.media_url ?? ""}
            autoPlay
            playsInline
            muted={muted}
            className="pointer-events-none h-full w-full bg-black object-contain"
            onEnded={advance}
            onError={advance}
            onTimeUpdate={(e) => {
              const el = e.currentTarget;
              if (Number.isFinite(el.duration) && el.duration > 0) {
                setVideoPct(Math.min(1, el.currentTime / el.duration));
              }
            }}
          />
        ) : (
          <img
            key={`${activeId}-${current.id}`}
            src={current.media_url ?? ""}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
          />
        )}

        {/* progress + header */}
        <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/75 via-black/35 to-transparent px-4 pb-8 pt-[max(env(safe-area-inset-top),1rem)]">
          <div className="flex gap-1">
            {activeStories.map((s, i) => (
              <div key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
                {i < index && <span className="block h-full w-full bg-white/90" />}
                {i === index &&
                  (mediaIsVideo ? (
                    <span
                      className="block h-full bg-white/90"
                      style={{ width: `${Math.round(videoPct * 100)}%` }}
                    />
                  ) : (
                    <span
                      key={`${activeId}-${current.id}-bar`}
                      className="block h-full animate-story-progress bg-white/90"
                      style={{ animationPlayState: paused ? "paused" : "running" }}
                      onAnimationEnd={advance}
                    />
                  ))}
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <Avatar
              src={activeGroup.user.avatar_url || fallbackAvatar(activeGroup.user.id)}
              name={name}
              seed={activeGroup.user.id}
              size={36}
              className="ring-2 ring-white/30"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-white">{name}</p>
              <p className="text-[11px] text-white/70">{relativeTime(current.created_at)}</p>
            </div>
            {mediaIsVideo && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "Unmute video" : "Mute video"}
                className="grid size-9 place-items-center rounded-full bg-black/35 text-white/90 transition active:scale-95"
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}
            {isOwn && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={() => {
                  setDeleteError(null);
                  setOptionsOpen(true);
                }}
                aria-label="Status options"
                aria-haspopup="menu"
                className="grid size-9 place-items-center rounded-full bg-black/35 text-white/90 transition active:scale-95"
              >
                <MoreVertical size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={close}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              aria-label="Close"
              className="grid size-9 place-items-center rounded-full bg-black/35 text-white/90"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* caption */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-10">
          {current.caption && <p className="text-[15px] leading-snug text-white/95">{current.caption}</p>}
          {isOwn && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-black/45 px-3 py-1.5 text-[12px] text-white/90">
              <Eye size={13} /> {viewCounts[current.id] ?? 0} {viewCounts[current.id] === 1 ? "view" : "views"}
            </p>
          )}
        </div>

        {/* own-status options: playback pauses while this is open */}
        {optionsOpen && (
          <div
            className="absolute inset-0 z-30 flex flex-col justify-end"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close options"
              onClick={() => {
                if (!deleting) setOptionsOpen(false);
              }}
              className="absolute inset-0 bg-black/55"
            />
            <div className="relative mx-3 mb-[max(env(safe-area-inset-bottom),0.75rem)] overflow-hidden rounded-[22px] bg-[#1C1C1E] text-white shadow-2xl">
              <p className="border-b border-white/10 px-4 py-3 text-[12.5px] leading-snug text-white/60">
                It disappears for everyone right away.
              </p>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void deleteCurrent()}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-semibold text-red-400 transition active:bg-white/5 disabled:opacity-60"
              >
                {deleting ? <Spinner /> : <Trash2 size={17} />}
                {deleting ? "Deleting…" : "Delete story"}
              </button>
              {deleteError && <p className="px-4 pb-3 text-[12px] text-red-400/90">{deleteError}</p>}
              <div className="h-px bg-white/10" />
              <button
                type="button"
                disabled={deleting}
                onClick={() => setOptionsOpen(false)}
                className="w-full px-4 py-3.5 text-center text-[15px] font-semibold text-white/90 transition active:bg-white/5 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
