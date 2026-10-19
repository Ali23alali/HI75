import { useEffect, useState } from "react";
import { cn, hueFromString, initials } from "@/lib/utils";

type Props = {
  src?: string | null;
  name: string;
  seed?: string;
  size?: number;
  className?: string;
  ring?: boolean;
};

/** Circular avatar with graceful letter fallback. */
export function Avatar({ src, name, seed, size = 48, className, ring = false }: Props) {
  const [broken, setBroken] = useState(false);
  const hue = hueFromString(seed || name || "hi");
  const showImage = Boolean(src) && !broken;

  useEffect(() => {
    setBroken(false);
  }, [src]);

  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2",
        ring && "ring-1 ring-line",
        className
      )}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img
          src={src as string}
          alt={name}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : null}
      {!showImage ? (
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center font-semibold text-white/90"
          style={{
            fontSize: size * 0.34,
            background: `linear-gradient(140deg, hsl(${hue} 42% 26%), hsl(${(hue + 48) % 360} 38% 14%))`,
          }}
        >
          {initials(name)}
        </span>
      ) : null}
    </span>
  );
}
