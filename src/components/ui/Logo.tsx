import { cn } from "@/lib/utils";

/** The near-black squircle "hi" mark. */
export function Logo({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn(
        "grid select-none place-items-center bg-strong text-strong-fg shadow-[0_18px_45px_-18px_rgba(11,11,12,0.55)]",
        className
      )}
      style={{ width: size, height: size, borderRadius: size * 0.34 }}
    >
      <span
        className="font-semibold leading-none tracking-[-0.06em]"
        style={{ fontSize: size * 0.42, fontFamily: "Inter Variable, Inter, sans-serif" }}
      >
        hi
      </span>
    </div>
  );
}
