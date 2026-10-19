import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, RefreshCcw, X } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

const MAX_SECONDS = 30;

export type Capture = { blob: Blob; mime: string };

/**
 * Full-screen camera: live preview (front/back), photo capture and video
 * recording (up to 30s). Falls back to the gallery picker when the browser
 * has no camera or permission is denied.
 */
export function CameraCapture({
  open,
  onClose,
  onCapture,
  onUpload,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (capture: Capture) => void;
  onUpload: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const discardRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [flash, setFlash] = useState(false);

  const stopStream = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      discardRef.current = true;
      rec.stop();
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setReady(false);
    setRecording(false);
  }, []);

  // start the camera when opened (and after a front/back flip)
  useEffect(() => {
    if (!open) {
      stopStream();
      setError(null);
      setMode("photo");
      setSeconds(0);
      return;
    }
    let cancelled = false;
    setError(null);
    setReady(false);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        const constraints: MediaStreamConstraints = {
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        };
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ ...constraints, audio: true });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          await el.play().catch(() => {});
        }
        setReady(true);
      } catch {
        if (cancelled) return;
        if (facing === "user") setFacing("environment");
        else setError("Camera unavailable — check browser permissions, or upload instead.");
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, facing, stopStream]);

  // recording timer
  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  useEffect(() => {
    if (recording && seconds >= MAX_SECONDS) stopRecording();
  }, [recording, seconds, stopRecording]);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !ready) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facing === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 140);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture({ blob, mime: "image/jpeg" });
      },
      "image/jpeg",
      0.92
    );
  }

  function pickVideoMime(): string {
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    for (const c of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(c)) return c;
      } catch {
        /* try the next one */
      }
    }
    return "video/webm";
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || !ready) return;
    if (typeof MediaRecorder === "undefined") {
      setError("Recording isn't supported in this browser — take a photo instead.");
      return;
    }
    try {
      const mime = pickVideoMime();
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
      discardRef.current = false;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        recorderRef.current = null;
        const type = mime.split(";")[0] || "video/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        setRecording(false);
        setSeconds(0);
        if (!discardRef.current && blob.size > 0) onCapture({ blob, mime: type });
      };
      recorderRef.current = rec;
      rec.start(250);
      setRecording(true);
      setSeconds(0);
    } catch {
      setError("Recording isn't supported in this browser — take a photo instead.");
    }
  }

  function onShutter() {
    if (!ready) return;
    if (mode === "photo") capturePhoto();
    else if (recording) stopRecording();
    else startRecording();
  }

  function handleUpload() {
    discardRef.current = true;
    stopRecording();
    onUpload();
  }

  if (!open) return null;

  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[70] flex justify-center bg-black">
      <div className="relative flex h-full w-full max-w-[390px] flex-col overflow-hidden bg-black text-white">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
          style={facing === "user" ? { transform: "scaleX(-1)" } : undefined}
        />

        {/* shutter flash */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-20 bg-white transition-opacity duration-150",
            flash ? "opacity-90" : "opacity-0"
          )}
        />

        {/* top bar */}
        <div className="relative z-10 flex items-center justify-between gap-2 px-4 pt-[max(env(safe-area-inset-top),1rem)]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera"
            className="grid size-10 place-items-center rounded-full bg-black/40 backdrop-blur transition active:scale-95"
          >
            <X size={20} />
          </button>

          {recording ? (
            <span className="flex items-center gap-2 rounded-pill bg-black/45 px-3.5 py-1.5 text-[12.5px] font-semibold tabular-nums backdrop-blur">
              <span className="size-2 animate-pulse rounded-full bg-red-500" />
              {clock}
            </span>
          ) : (
            <div className="flex rounded-pill bg-black/40 p-1 text-[12px] font-semibold backdrop-blur">
              <button
                type="button"
                onClick={() => setMode("photo")}
                aria-pressed={mode === "photo"}
                className={cn(
                  "rounded-pill px-3.5 py-1.5 transition",
                  mode === "photo" ? "bg-white text-ink" : "text-white/75"
                )}
              >
                Photo
              </button>
              <button
                type="button"
                onClick={() => setMode("video")}
                aria-pressed={mode === "video"}
                className={cn(
                  "rounded-pill px-3.5 py-1.5 transition",
                  mode === "video" ? "bg-white text-ink" : "text-white/75"
                )}
              >
                Video
              </button>
            </div>
          )}

          <span className="size-10" />
        </div>

        {error && (
          <div className="relative z-10 mx-auto mt-4 max-w-[300px] rounded-2xl bg-white/10 px-4 py-3 text-center text-[12.5px] text-white/85 backdrop-blur">
            {error}
          </div>
        )}

        {!ready && !error && (
          <div className="absolute inset-0 z-10 grid place-items-center">
            <Spinner />
          </div>
        )}

        {/* bottom controls */}
        <div className="relative z-10 mt-auto px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <p className="mb-4 text-center text-[12px] text-white/60">
            {mode === "video"
              ? recording
                ? "Tap to stop — up to 30s"
                : "Tap to record a video"
              : "Tap the shutter for a photo"}
          </p>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleUpload}
              aria-label="Upload from gallery"
              className="grid size-12 place-items-center rounded-full bg-white/12 backdrop-blur transition active:scale-95"
            >
              <ImagePlus size={20} />
            </button>

            <button
              type="button"
              onClick={onShutter}
              disabled={!ready}
              aria-label={mode === "video" ? (recording ? "Stop recording" : "Record video") : "Take photo"}
              className={cn(
                "relative grid size-20 place-items-center rounded-full border-4 border-white/85 transition active:scale-95 disabled:opacity-40",
                mode === "photo" && "bg-white/15"
              )}
            >
              {mode === "photo" ? (
                <span className="size-14 rounded-full bg-white" />
              ) : (
                <span
                  className={cn(
                    "bg-red-500 transition-all",
                    recording ? "size-7 rounded-lg" : "size-14 rounded-full"
                  )}
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
              aria-label="Flip camera"
              className="grid size-12 place-items-center rounded-full bg-white/12 backdrop-blur transition active:scale-95"
            >
              <RefreshCcw size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
