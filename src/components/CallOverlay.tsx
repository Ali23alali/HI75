import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Video, VideoOff } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { stopRingtone } from "@/lib/ringtone";

export type CallMode = "voice" | "video";

/**
 * Full-screen call experience. There is no signalling backend, so this is a
 * simulated outgoing call that rings indefinitely — it never auto-answers.
 * The ringtone plays until the user ends the call. For video calls the local
 * camera preview is live (when permission is granted).
 */
export function CallOverlay({
  open,
  mode,
  name,
  avatarUrl,
  seed,
  onClose,
}: {
  open: boolean;
  mode: CallMode;
  name: string;
  avatarUrl: string;
  seed?: string;
  onClose: () => void;
}) {
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [camOn, setCamOn] = useState(mode === "video");
  const [selfReady, setSelfReady] = useState(false);
  const selfRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopSelf = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (selfRef.current) selfRef.current.srcObject = null;
    setSelfReady(false);
  }, []);

  // never leave a ringtone running if the overlay disappears mid-ring
  useEffect(() => () => stopRingtone(), []);

  // reset controls on open — the call stays in the ringing state until ended
  useEffect(() => {
    if (!open) return;
    setMuted(false);
    setSpeaker(false);
    setCamOn(mode === "video");
  }, [open, mode]);

  // live self-view for video calls
  useEffect(() => {
    if (!open || mode !== "video" || !camOn) {
      stopSelf();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (selfRef.current) {
          selfRef.current.srcObject = stream;
          await selfRef.current.play().catch(() => {});
        }
        setSelfReady(true);
      } catch {
        if (!cancelled) setSelfReady(false);
      }
    })();
    return () => {
      cancelled = true;
      stopSelf();
    };
  }, [open, mode, camOn, stopSelf]);

  // escape ends the call
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative flex h-dvh w-full max-w-[390px] flex-col overflow-hidden bg-[#0B0B0C] text-white">
        {/* ambient light */}
        <span className="pointer-events-none absolute -left-24 top-1/4 size-72 rounded-full bg-accent/25 blur-[110px]" />
        <span className="pointer-events-none absolute -right-28 bottom-10 size-72 rounded-full bg-accent/10 blur-[110px]" />

        <header className="relative z-10 flex flex-col items-center gap-1 px-6 pt-[max(env(safe-area-inset-top),1.25rem)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
            {mode === "video" ? "Video call" : "Voice call"}
          </p>
        </header>

        {/* peer */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-10">
          <div className="relative grid place-items-center">
            <span className="absolute size-[168px] animate-ping rounded-full bg-white/10 [animation-duration:2s]" />
            <span className="absolute size-[196px] animate-ping rounded-full bg-white/[0.06] [animation-duration:2.4s]" />
            <span className="relative rounded-full p-1 shadow-[0_0_70px_-10px_rgba(74,150,255,0.35)]">
              <Avatar src={avatarUrl} name={name} seed={seed} size={132} />
            </span>
          </div>
          <h1 className="mt-7 max-w-full truncate text-[26px] font-semibold tracking-[-0.02em]">{name}</h1>
          <p className="mt-1.5 flex items-center gap-2 text-[13.5px] text-white/55">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" />
            {mode === "video" ? "Ringing…" : "Calling…"}
          </p>
        </div>

        {/* local self-view */}
        {mode === "video" && camOn && (
          <div className="absolute right-4 top-[max(env(safe-area-inset-top),4.5rem)] z-20 h-40 w-[116px] overflow-hidden rounded-[20px] border border-white/15 bg-white/5 shadow-2xl">
            <video
              ref={selfRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "h-full w-full -scale-x-100 object-cover transition-opacity",
                selfReady ? "opacity-100" : "opacity-0"
              )}
            />
            {!selfReady && (
              <span className="absolute inset-0 grid place-items-center text-[11px] font-medium text-white/45">
                You
              </span>
            )}
          </div>
        )}

        {/* controls */}
        <div className="relative z-10 px-6 pb-[max(env(safe-area-inset-bottom),2rem)]">
          <div className="mb-7 flex items-center justify-center gap-5">
            <CallControl
              label={muted ? "Unmute" : "Mute"}
              active={muted}
              onClick={() => setMuted((v) => !v)}
            >
              {muted ? <MicOff size={21} /> : <Mic size={21} />}
            </CallControl>
            <CallControl
              label={speaker ? "Speaker off" : "Speaker"}
              active={speaker}
              onClick={() => setSpeaker((v) => !v)}
            >
              {speaker ? <Volume2 size={21} /> : <VolumeX size={21} />}
            </CallControl>
            {mode === "video" && (
              <CallControl
                label={camOn ? "Camera off" : "Camera on"}
                active={!camOn}
                onClick={() => setCamOn((v) => !v)}
              >
                {camOn ? <Video size={21} /> : <VideoOff size={21} />}
              </CallControl>
            )}
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={onClose}
              aria-label="End call"
              className="grid size-16 place-items-center rounded-full bg-[#FF453A] text-white shadow-[0_20px_40px_-16px_rgba(255,69,58,0.8)] transition active:scale-95"
            >
              <PhoneOff size={25} />
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] text-white/40">End call</p>
        </div>
      </div>
    </div>
  );
}

function CallControl({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "grid size-14 place-items-center rounded-full border transition active:scale-95",
        active
          ? "border-white bg-white text-ink"
          : "border-white/10 bg-white/10 text-white hover:bg-white/15"
      )}
    >
      {children}
    </button>
  );
}
