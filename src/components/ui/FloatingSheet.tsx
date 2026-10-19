import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type FloatingSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Plain content, or a render-prop that receives the "shown" flag for staggers. */
  children: ReactNode | ((shown: boolean) => ReactNode);
  className?: string;
  label?: string;
};

/**
 * Bottom-sheet primitive with real enter *and* exit animations (no library):
 * the panel stays mounted for 320ms after `open` flips to false so the closing
 * transition can play. Closes on backdrop click and Escape, locks body scroll.
 */
export function FloatingSheet({ open, onClose, children, className, label }: FloatingSheetProps) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // presence: mount -> paint closed -> flip to shown (enter), reverse on exit
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = window.setTimeout(() => setShown(true), 20);
      return () => window.clearTimeout(id);
    }
    setShown(false);
    const id = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(id);
  }, [open]);

  // Escape closes, background scroll locks while mounted
  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, onClose]);

  // move focus into the sheet once it is visible
  useEffect(() => {
    if (!shown) return;
    const id = window.setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 40);
    return () => window.clearTimeout(id);
  }, [shown]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      {/* backdrop */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className={cn(
          "absolute inset-0 cursor-default bg-black/25 backdrop-blur-[2px] transition-opacity duration-200 ease-out",
          shown ? "opacity-100" : "opacity-0"
        )}
      />

      {/* panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-[390px] px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] outline-none",
          "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          shown ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0",
          className
        )}
      >
        {typeof children === "function" ? children(shown) : children}
      </div>
    </div>
  );
}
