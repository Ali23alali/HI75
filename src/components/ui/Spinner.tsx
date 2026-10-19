import { cn } from "@/lib/utils";

/**
 * Spinner ring. `tone="light"` (default) is for dark or colored surfaces
 * (ink/accent buttons); `tone="dark"` for light surfaces (canvas, white cards).
 */
export function Spinner({
  className,
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block size-5 animate-spin rounded-full border-2",
        tone === "light" ? "border-white/25 border-t-white" : "border-ink/20 border-t-ink",
        className
      )}
    />
  );
}

export function FullScreenLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-3">
        <Spinner tone="dark" />
        <p className="text-xs uppercase tracking-[0.3em] text-muted">{label}</p>
      </div>
    </div>
  );
}
