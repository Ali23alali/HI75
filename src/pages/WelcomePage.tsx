import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { Logo } from "@/components/ui/Logo";
import { ORBIT_AVATARS } from "@/lib/avatars";

const INNER = [0, 1, 2, 3, 4];
const OUTER = [5, 6, 7, 8, 9];

export default function WelcomePage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate("/messages", { replace: true });
  }, [loading, session, navigate]);

  function enter() {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => {
      navigate(session ? "/messages" : "/auth");
    }, 320);
  }

  return (
    <PhoneFrame>
      <div
        className={`relative flex flex-1 flex-col items-center px-8 pb-12 pt-14 transition duration-300 ${
          leaving ? "scale-[0.98] opacity-0" : "opacity-100"
        }`}
      >
        {/* ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[18%] h-72 w-72 -translate-x-1/2 rounded-full bg-surface/80 blur-3xl dark:bg-accent/10"
        />

        {/* orbit stage */}
        <div className="relative mt-6 grid h-[310px] w-[310px] place-items-center">
          <div className="absolute inset-0 rounded-full border border-line/90" />
          <div className="absolute inset-[52px] rounded-full border border-line/90" />
          <div className="absolute inset-[104px] rounded-full bg-surface/60" />

          <OrbitRing avatars={INNER} duration="48s" reverse={false} radius={127} size={40} />
          <OrbitRing avatars={OUTER} duration="64s" reverse radius={101} size={34} />

          <div className="relative z-10 animate-fade-up">
            <Logo size={104} />
          </div>
        </div>

        <div className="mt-12 text-center animate-fade-up [animation-delay:120ms]">
          <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.03em]">Friend&rsquo;s Contact</h1>
          <p className="mt-2 text-[15px] text-muted">Enjoy the first AI-powered chat</p>
        </div>

        <div className="mt-auto w-full animate-fade-up pt-12 [animation-delay:220ms]">
          <button
            type="button"
            onClick={enter}
            className="h-14 w-full rounded-pill border border-line bg-gradient-to-b from-white via-[#f2f2f4] to-[#cfcfd4] text-[16px] font-semibold text-black shadow-[0_18px_50px_-20px_rgba(16,17,20,0.45)] transition active:scale-[0.98] dark:from-[#2c2c32] dark:via-[#242429] dark:to-[#1b1b1f] dark:text-ink"
          >
            Enter
          </button>
          <p className="mt-4 text-center text-[11px] uppercase tracking-[0.28em] text-muted/70">hi · private by default</p>
        </div>
      </div>
    </PhoneFrame>
  );
}

function OrbitRing({
  avatars,
  duration,
  reverse,
  radius,
  size,
}: {
  avatars: number[];
  duration: string;
  reverse: boolean;
  radius: number;
  size: number;
}) {
  return (
    <div
      className="absolute inset-0"
      style={{
        animation: `${reverse ? "orbit-reverse" : "orbit"} ${duration} linear infinite`,
      }}
    >
      {avatars.map((index, i) => {
        const angle = (360 / avatars.length) * i;
        return (
          <div
            key={index}
            className="absolute left-1/2 top-1/2"
            style={{
              transform: `rotate(${angle}deg) translate(${radius}px) rotate(-${angle}deg)`,
            }}
          >
            <div
              className="-translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-line bg-surface-2 shadow-[0_10px_24px_-14px_rgba(16,17,20,0.4)]"
              style={{ width: size, height: size }}
            >
              <img
                src={ORBIT_AVATARS[index]}
                alt=""
                draggable={false}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
