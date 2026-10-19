import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpRight,
  Phone,
  PhoneCall,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { CallOverlay, type CallMode } from "@/components/CallOverlay";
import { useCalls, type CallKind, type CallListItem } from "@/hooks/useCalls";
import { useSimulatedCall } from "@/hooks/useSimulatedCall";
import { fallbackAvatar } from "@/lib/avatars";
import { supabase } from "@/lib/supabase";
import { clockTime, cn, dayLabel, formatClock } from "@/lib/utils";

const KIND_META: Record<CallKind, { label: string; Icon: LucideIcon }> = {
  outgoing: { label: "Outgoing", Icon: ArrowUpRight },
  incoming: { label: "Incoming", Icon: ArrowDownRight },
  missed: { label: "Missed", Icon: ArrowDownLeft },
};

/**
 * Call history list used by the Calls section of the chats screen: kind arrows
 * (outgoing ↗ / incoming ↘ / missed ↙ red), avatar with voice/video badge,
 * date + time, and a one-tap redial button matching the original call mode.
 */
export function CallsList() {
  const navigate = useNavigate();
  const { calls, loading, error } = useCalls();
  const { active, beginCall, endCall } = useSimulatedCall();
  const [actionError, setActionError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  async function openChat(peerId: string) {
    if (opening) return;
    setOpening(peerId);
    setActionError(null);
    const { data, error: rpcError } = await supabase.rpc("start_direct_chat", { other: peerId });
    setOpening(null);
    if (rpcError || !data) {
      setActionError(rpcError?.message ?? "Could not open this chat.");
      return;
    }
    navigate(`/messages/${data}`);
  }

  function redial(call: CallListItem) {
    if (!call.peer) return;
    const name = call.peer.display_name || call.peer.username;
    beginCall(
      {
        id: call.peer.id,
        name,
        avatarUrl: call.peer.avatar_url || fallbackAvatar(call.peer.id),
        seed: call.peer.id,
      },
      (call.mode === "video" ? "video" : "voice") as CallMode
    );
  }

  // day sections, newest first
  const sections: Array<{ day: string; items: CallListItem[] }> = [];
  for (const call of calls) {
    const day = dayLabel(call.created_at);
    const last = sections[sections.length - 1];
    if (last && last.day === day) last.items.push(call);
    else sections.push({ day, items: [call] });
  }

  return (
    <div className="space-y-6">
      {actionError && (
        <p className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-600 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-400">
          {actionError}
        </p>
      )}

      {loading && (
        <div className="overflow-hidden rounded-[26px] border border-line bg-surface/70 shadow-[0_18px_40px_-30px_rgba(16,17,20,0.5)]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line/60 px-4 py-3.5 last:border-b-0">
              <span className="size-11 shrink-0 animate-pulse rounded-full bg-surface-2" />
              <span className="flex-1 space-y-2">
                <span className="block h-3 w-32 animate-pulse rounded-full bg-surface-2" />
                <span className="block h-2.5 w-44 animate-pulse rounded-full bg-surface-2" />
              </span>
              <span className="size-10 shrink-0 animate-pulse rounded-full bg-surface-2" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="rounded-[26px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && calls.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-[26px] border border-line bg-surface px-6 py-10 text-center shadow-[0_18px_40px_-30px_rgba(16,17,20,0.5)]">
          <span className="grid size-14 place-items-center rounded-full bg-accent/10 text-accent">
            <PhoneCall size={24} />
          </span>
          <p className="text-[15px] font-semibold">No calls yet</p>
          <p className="max-w-[230px] text-[12.5px] leading-relaxed text-muted">
            Calls you make or receive in hi show up here automatically.
          </p>
        </div>
      )}

      {!loading &&
        !error &&
        sections.map(({ day, items }) => (
          <section key={day} className="space-y-2">
            <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/80">
              {day}
            </h2>
            <div className="divide-y divide-line/60 overflow-hidden rounded-[26px] border border-line bg-surface shadow-[0_18px_40px_-30px_rgba(16,17,20,0.5)]">
              {items.map((call) => {
                const meta = KIND_META[call.kind];
                const name = call.peer
                  ? call.peer.display_name || call.peer.username
                  : "Unknown caller";
                const missed = call.kind === "missed";
                return (
                  <div
                    key={call.id}
                    role={call.peer ? "link" : undefined}
                    tabIndex={call.peer ? 0 : undefined}
                    onClick={() => call.peer && void openChat(call.peer.id)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" && call.peer) {
                        e.preventDefault();
                        void openChat(call.peer.id);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3.5 transition",
                      call.peer && "cursor-pointer active:bg-ink/[0.03]",
                      opening === call.peer?.id && "opacity-60"
                    )}
                  >
                    <span className="relative shrink-0">
                      <Avatar
                        src={call.peer?.avatar_url || (call.peer ? fallbackAvatar(call.peer.id) : null)}
                        name={name}
                        seed={call.peer?.id ?? call.id}
                        size={44}
                      />
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full ring-2 ring-surface",
                          missed ? "bg-red-500" : "bg-accent"
                        )}
                      >
                        {call.mode === "video" ? (
                          <Video size={11} className="text-white" />
                        ) : (
                          <Phone size={10} className="text-white" />
                        )}
                      </span>
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold">{name}</span>
                      <span
                        className={cn(
                          "mt-0.5 flex items-center gap-1.5 text-[12px] font-medium",
                          missed ? "text-red-600 dark:text-red-400" : "text-muted"
                        )}
                      >
                        <meta.Icon size={13} strokeWidth={2.6} />
                        {meta.label}
                        {" · "}
                        {clockTime(call.created_at)}
                        {call.kind === "incoming" && call.duration_seconds > 0 && (
                          <>{" · "}{formatClock(call.duration_seconds)}</>
                        )}
                      </span>
                    </span>

                    <button
                      type="button"
                      disabled={!call.peer}
                      onClick={(e) => {
                        e.stopPropagation();
                        redial(call);
                      }}
                      aria-label={
                        call.peer
                          ? `Call ${name} back (${call.mode === "video" ? "video" : "voice"})`
                          : "Call unavailable"
                      }
                      className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-accent shadow-[0_10px_24px_-18px_rgba(30,123,255,0.8)] transition active:scale-95 disabled:opacity-40"
                    >
                      {call.mode === "video" ? <Video size={17} /> : <Phone size={16} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

      <CallOverlay
        open={active !== null}
        mode={active?.mode ?? "voice"}
        name={active?.target.name ?? ""}
        avatarUrl={active?.target.avatarUrl ?? ""}
        seed={active?.target.seed}
        onClose={endCall}
      />
    </div>
  );
}
