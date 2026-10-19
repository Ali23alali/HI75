import type { ReactNode } from "react";

const UNVIEWED = "rgb(var(--accent))"; // accent blue
const VIEWED = "#C7C7CC";

/**
 * Status ring with one arc per story: blue arcs are unwatched, gray are watched.
 * Wrap an <Avatar /> inside; the ring sits just outside its edge.
 */
export function StoryRing({
  viewed,
  size = 54,
  children,
}: {
  viewed: boolean[];
  size?: number;
  children: ReactNode;
}) {
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const n = Math.max(viewed.length, 1);
  const seg = C / n;
  const gap = n > 1 ? Math.min(8, seg * 0.22) : 0;
  const dash = Math.max(seg - gap, 1);

  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        className="absolute inset-0 -rotate-90"
      >
        {viewed.map((seen, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={seen ? VIEWED : UNVIEWED}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${Math.max(C - dash, 0)}`}
            strokeDashoffset={(C - i * seg) % C}
          />
        ))}
      </svg>
      {children}
    </span>
  );
}
