import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn, formatClock } from "@/lib/utils";

const urlCache = new Map<string, string>();

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)$/i;
const AUDIO_EXT = /\.(m4a|mp3|ogg|oga|wav|aac|opus)$/i;

/**
 * Renders a private chat-media object via a short-lived signed URL — a plain
 * image, an inline player for videos, or a compact voice-note player for audio.
 */
export function SignedMedia({
  path,
  type,
  tone = "surface",
  className,
}: {
  path: string;
  type?: string | null;
  /** "onAccent" keeps controls readable on the blue outgoing bubble. */
  tone?: "surface" | "onAccent";
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(urlCache.get(path) ?? null);

  useEffect(() => {
    let alive = true;
    const cached = urlCache.get(path);
    if (cached) {
      setUrl(cached);
      return;
    }
    void supabase.storage
      .from("chat-media")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (!alive || !data?.signedUrl) return;
        urlCache.set(path, data.signedUrl);
        setUrl(data.signedUrl);
      });
    return () => {
      alive = false;
    };
  }, [path]);

  const isVideo = type ? type === "video" : VIDEO_EXT.test(path);
  const isAudio = type ? type === "audio" : AUDIO_EXT.test(path);

  if (!url) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-2xl bg-surface-2",
          isVideo ? "h-40" : isAudio ? "h-10 w-[190px]" : "",
          className
        )}
      />
    );
  }
  if (isVideo) {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className={cn("mx-auto bg-black", className)}
      />
    );
  }
  if (isAudio) {
    return <AudioNote url={url} onAccent={tone === "onAccent"} className={className} />;
  }
  return <img src={url} alt="" loading="lazy" className={className} draggable={false} />;
}

/** Compact voice-note player: play/pause, seekable bar, elapsed/total time. */
function AudioNote({
  url,
  onAccent,
  className,
}: {
  url: string;
  onAccent: boolean;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(null);
  }, [url]);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => setPlaying(false));
    else el.pause();
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
  }

  const progress = duration ? Math.min(1, current / duration) : 0;

  return (
    <div className={cn("flex w-[190px] max-w-full items-center gap-2.5", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full transition active:scale-95",
          onAccent ? "bg-white/25 text-white hover:bg-white/35" : "bg-accent text-white"
        )}
      >
        {playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Seek voice note"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          onClick={seek}
          onKeyDown={(e) => {
            const el = audioRef.current;
            if (!el || !duration) return;
            if (e.key === "ArrowRight") el.currentTime = Math.min(duration, el.currentTime + 5);
            if (e.key === "ArrowLeft") el.currentTime = Math.max(0, el.currentTime - 5);
          }}
          className={cn(
            "h-1.5 cursor-pointer rounded-full",
            onAccent ? "bg-white/25" : "bg-ink/10"
          )}
        >
          <div
            className={cn("h-full rounded-full", onAccent ? "bg-white" : "bg-accent")}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div
          className={cn(
            "mt-1 flex justify-between text-[10.5px] font-medium tabular-nums",
            onAccent ? "text-white/75" : "text-muted"
          )}
        >
          <span>{formatClock(current)}</span>
          <span>{duration !== null ? formatClock(duration) : "--:--"}</span>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setDuration(Number.isFinite(d) ? d : null);
        }}
        className="hidden"
      />
    </div>
  );
}
