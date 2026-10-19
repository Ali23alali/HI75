import { useCallback, useState, type ReactNode } from "react";
import {
  Check,
  ChevronRight,
  LogOut,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { FloatingSheet } from "@/components/ui/FloatingSheet";
import { PRESENCE_ORDER, type PresenceStatus } from "@/lib/presence";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Presence status                                                             */
/* -------------------------------------------------------------------------- */

export type { PresenceStatus };

type StatusMeta = { label: string; description: string; dot: string };

export const STATUS_META: Record<PresenceStatus, StatusMeta> = {
  online: { label: "Online", description: "Ready for messages", dot: "bg-accent" },
  idle: { label: "Idle", description: "Away for a moment", dot: "bg-[#FF9F0A]" },
  dnd: { label: "Do Not Disturb", description: "Notifications muted", dot: "bg-[#FF453A]" },
};

/** Small colored presence dot with a soft glow — drop it on any avatar. */
export function StatusDot({
  status,
  size = 12,
  halo = true,
  className,
}: {
  status: PresenceStatus;
  size?: number;
  halo?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {halo && (
        <span className={cn("absolute inset-0 rounded-full opacity-40 blur-[5px]", STATUS_META[status].dot)} />
      )}
      <span
        className={cn("relative rounded-full ring-2 ring-white", STATUS_META[status].dot)}
        style={{ width: size * 0.76, height: size * 0.76 }}
      />
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Status / account menu                                                       */
/* -------------------------------------------------------------------------- */

type AccountAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
};

export type StatusMenuProps = {
  /** Currently selected presence — controlled, keep it wherever you like. */
  status: PresenceStatus;
  onStatusChange: (status: PresenceStatus) => void;
  name: string;
  username?: string;
  avatarUrl?: string | null;
  /** Stable id used for the letter-avatar fallback color. */
  seed?: string;
  onProfile?: () => void;
  onPreferences?: () => void;
  onSignOut?: () => void;
  /** Replace the trigger content — the outer button (and its ARIA) stays. */
  trigger?: ReactNode;
  /** Optional persistence error — rendered inside the sheet when set. */
  error?: string | null;
};

export function StatusMenu({
  status,
  onStatusChange,
  name,
  username,
  avatarUrl,
  seed,
  onProfile,
  onPreferences,
  onSignOut,
  trigger,
  error,
}: StatusMenuProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const meta = STATUS_META[status];

  const actions: AccountAction[] = [];
  if (onProfile) actions.push({ id: "profile", label: "View profile", icon: UserRound, onSelect: onProfile });
  if (onPreferences)
    actions.push({ id: "preferences", label: "Preferences", icon: SlidersHorizontal, onSelect: onPreferences });
  if (onSignOut) actions.push({ id: "signout", label: "Log out", icon: LogOut, onSelect: onSignOut, danger: true });

  return (
    <>
      {/* trigger — avatar + presence dot */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        className="relative shrink-0 rounded-full outline-none transition-transform duration-200 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        {trigger ?? (
          <>
            <Avatar src={avatarUrl} name={name} seed={seed} size={40} ring />
            <StatusDot status={status} size={13} className="absolute -bottom-0.5 -right-0.5" />
          </>
        )}
      </button>

      {/* sheet */}
      <FloatingSheet open={open} onClose={close} label={`${name} status and account menu`}>
        {(shown) => (
          <div className="relative overflow-hidden rounded-[32px] border border-line bg-surface/90 p-3 shadow-[0_32px_90px_-30px_rgba(16,17,20,0.45)] backdrop-blur-2xl">
            {/* glass top highlight */}
            <span className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-ink/10 to-transparent" />

            {/* grabber */}
            <span className="mx-auto mb-4 mt-1 block h-1.5 w-11 rounded-full bg-ink/15" />

            {/* identity header */}
            <div className="flex items-center gap-3.5 px-2 pb-4">
              <div className="relative shrink-0">
                <Avatar src={avatarUrl} name={name} seed={seed} size={52} ring />
                <StatusDot status={status} size={14} className="absolute -bottom-0.5 -right-0.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-semibold leading-tight">{name}</p>
                {username && <p className="mt-0.5 truncate text-[13px] text-muted">@{username}</p>}
              </div>
              <span className="inline-flex shrink-0 items-center gap-2 rounded-pill border border-line bg-surface-2 py-1.5 pl-2.5 pr-3 text-[12px] font-medium text-ink/80">
                <span className={cn("size-2 rounded-full", meta.dot)} />
                {meta.label}
              </span>
            </div>

            {error && (
              <p className="mx-2 mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-snug text-red-600 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-400">
                {error}
              </p>
            )}

            {/* status options */}
            <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Status</p>
            <div className="space-y-0.5">
              {PRESENCE_ORDER.map((value, index) => {
                const option = STATUS_META[value];
                const active = value === status;
                return (
                  <div
                    key={value}
                    className={cn(
                      "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                    )}
                    style={{ transitionDelay: shown ? `${80 + index * 45}ms` : "0ms" }}
                  >
                    <button
                      type="button"
                      onClick={() => onStatusChange(value)}
                      aria-pressed={active}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left outline-none transition-colors duration-150",
                        "hover:bg-ink/[0.04] active:bg-ink/[0.07]",
                        active && "bg-ink/[0.05]"
                      )}
                    >
                      <span className="relative grid size-7 shrink-0 place-items-center">
                        {active && (
                          <span className={cn("absolute inset-0 rounded-full opacity-50 blur-[6px]", option.dot)} />
                        )}
                        <span
                          className={cn(
                            "relative size-3 rounded-full transition-transform duration-300",
                            active ? "scale-110" : "scale-90",
                            option.dot
                          )}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium leading-snug text-ink/95">
                          {option.label}
                        </span>
                        <span className="block truncate text-[12px] leading-snug text-muted">
                          {option.description}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "grid size-6 shrink-0 place-items-center text-accent transition-all duration-300",
                          active ? "scale-100 opacity-100" : "scale-50 opacity-0"
                        )}
                      >
                        <Check size={16} strokeWidth={3} />
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* account actions */}
            {actions.length > 0 && (
              <>
                <div className="mx-2 my-3 h-px bg-gradient-to-r from-transparent via-ink/10 to-transparent" />
                <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
                  Account
                </p>
                <div className="space-y-0.5">
                  {actions.map((action, index) => (
                    <div
                      key={action.id}
                      className={cn(
                        "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                      )}
                      style={{
                        transitionDelay: shown ? `${80 + (PRESENCE_ORDER.length + index) * 45}ms` : "0ms",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          close();
                          action.onSelect();
                        }}
                        className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-ink/[0.04] active:bg-ink/[0.07]"
                      >
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-xl border",
                            action.danger
                              ? "border-red-200 bg-red-50 text-red-600 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-400"
                              : "border-line bg-surface-2 text-ink/70"
                          )}
                        >
                          <action.icon size={16} />
                        </span>
                        <span
                          className={cn(
                            "min-w-0 flex-1 text-[15px] font-medium",
                            action.danger ? "text-red-600 dark:text-red-400" : "text-ink/90"
                          )}
                        >
                          {action.label}
                        </span>
                        <ChevronRight
                          size={16}
                          className="shrink-0 text-muted/70 transition-transform duration-200 group-hover:translate-x-0.5"
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </FloatingSheet>
    </>
  );
}
