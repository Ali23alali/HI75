import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { extensionForMime, isVideoMime } from "@/lib/media";
import type { Capture } from "@/components/CameraCapture";

const MAX_BYTES = 45 * 1024 * 1024;

/**
 * Full-screen status composer: preview a captured or picked photo/video, add
 * a caption, upload to the public `stories` bucket (`<user_id>/<uuid>.<ext>`
 * — enforced by storage RLS) and insert the row. Expires automatically 24h later.
 */
export function StoryComposer({
  open,
  capture,
  onClose,
  onShared,
  onRetake,
  onOpenCamera,
}: {
  open: boolean;
  capture?: Capture | null;
  onClose: () => void;
  onShared: () => void;
  onRetake?: () => void;
  onOpenCamera?: () => void;
}) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [capturePreview, setCapturePreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setCaption("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!capture) {
      setCapturePreview(null);
      return;
    }
    const url = URL.createObjectURL(capture.blob);
    setCapturePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [capture]);

  const mediaUrl = file ? preview : capturePreview;
  const mediaMime = file ? file.type : capture?.mime ?? "";
  const mediaIsVideo = isVideoMime(mediaMime);
  const hasMedia = Boolean(mediaUrl);

  async function share() {
    const blob: Blob | null = file ?? capture?.blob ?? null;
    if (!user || !blob || busy) return;
    if (blob.size > MAX_BYTES) {
      setError("That clip is over 45 MB — try a shorter one.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const mime = (file ? file.type : capture?.mime) || blob.type || "image/jpeg";
      const ext = extensionForMime(mime);
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("stories")
        .upload(path, blob, { contentType: mime, upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("stories").getPublicUrl(path);
      const { error: insErr } = await supabase.from("stories").insert({
        user_id: user.id,
        media_url: pub.publicUrl,
        caption: caption.trim() || null,
      });
      if (insErr) throw insErr;

      onShared();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not share your status.");
    } finally {
      setBusy(false);
    }
  }

  function replace() {
    if (file) {
      setFile(null);
      return;
    }
    if (capture && onRetake) onRetake();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex justify-center bg-black/30">
      <div className="flex w-full max-w-[390px] flex-col bg-canvas text-ink">
        <header className="safe-top flex items-center justify-between px-5 pb-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-full bg-surface text-ink/80 shadow-sm"
          >
            <X size={18} />
          </button>
          <p className="text-sm font-semibold">New status</p>
          <span className="size-9" />
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-4">
          {hasMedia ? (
            mediaIsVideo ? (
              <video
                src={mediaUrl ?? undefined}
                controls
                playsInline
                className="max-h-[62vh] w-full rounded-[28px] bg-black"
              />
            ) : (
              <img
                src={mediaUrl ?? undefined}
                alt="Status preview"
                className="max-h-[62vh] w-full rounded-[28px] object-cover"
              />
            )
          ) : (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex aspect-[3/4] w-full max-w-[280px] flex-col items-center justify-center gap-3 rounded-[28px] border border-dashed border-line bg-surface/70 text-muted transition hover:text-ink"
              >
                <ImagePlus size={30} />
                <span className="text-sm font-medium">Photo or video</span>
                <span className="px-8 text-center text-[11px]">
                  It disappears from everyone’s feed after 24 hours.
                </span>
              </button>
              {onOpenCamera && (
                <button
                  type="button"
                  onClick={onOpenCamera}
                  className="flex items-center gap-2 rounded-pill border border-line bg-surface px-4 py-2 text-[12.5px] font-medium text-ink/80 transition active:scale-[0.97]"
                >
                  <Camera size={15} /> Open camera
                </button>
              )}
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              if (next && !next.type.startsWith("image/") && !next.type.startsWith("video/")) {
                setError("Only photos and videos can be shared.");
                setFile(null);
                return;
              }
              setError(null);
              setFile(next);
            }}
          />
        </div>

        <div className="safe-bottom space-y-3 px-6 pb-8">
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption…"
            aria-label="Caption"
            maxLength={140}
            className="h-14 w-full rounded-2xl border border-line bg-surface px-4 text-[15px] text-ink outline-none focus:border-ink/20"
          />
          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            {hasMedia && (
              <button
                type="button"
                onClick={replace}
                className="h-14 shrink-0 rounded-pill border border-line bg-surface px-5 text-sm font-medium text-ink/80"
              >
                {file ? "Replace" : "Retake"}
              </button>
            )}
            <button
              type="button"
              onClick={() => void share()}
              disabled={!(file || capture) || busy}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-pill bg-strong text-[15px] font-semibold text-strong-fg transition disabled:opacity-50"
            >
              {busy ? <Spinner /> : "Share status"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
