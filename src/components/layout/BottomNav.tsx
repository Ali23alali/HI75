import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Camera, Compass, MessageCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Floating dock from the reference design: two pill tabs (Explore / Chats)
 * around a prominent accent action that opens the story composer.
 */
export function BottomNav({ onCamera }: { onCamera?: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[390px] px-5 safe-bottom">
      <div className="pointer-events-auto relative mb-2 flex items-center gap-2 rounded-pill border border-line bg-surface/75 p-2 shadow-[0_24px_70px_-28px_rgba(16,17,20,0.45)] backdrop-blur-2xl">
        <DockPill to="/discover" label="Explore" Icon={Compass} active={pathname.startsWith("/discover")} />
        <button
          type="button"
          onClick={() => (onCamera ? onCamera() : navigate("/camera"))}
          aria-label="Add to status"
          className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-white shadow-[0_16px_34px_-10px_rgba(30,123,255,0.75)] transition active:scale-95"
        >
          <Camera size={20} />
        </button>
        <DockPill to="/messages" label="Chats" Icon={MessageCircle} active={pathname.startsWith("/messages")} />
      </div>
    </nav>
  );
}

function DockPill({
  to,
  label,
  Icon,
  active,
}: {
  to: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
}) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className={cn(
        "flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-pill text-[12.5px] font-semibold transition active:scale-[0.98]",
        active
          ? "bg-strong text-strong-fg shadow-[0_14px_28px_-14px_rgba(11,11,12,0.65)]"
          : "border border-line bg-surface text-ink/70 shadow-[0_10px_26px_-18px_rgba(16,17,20,0.5)]"
      )}
    >
      <Icon size={15} strokeWidth={active ? 2.5 : 2.1} />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}
