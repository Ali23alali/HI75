import { useCallback, useEffect, useRef, useState } from "react";

export type AudioClip = { blob: Blob; mime: string; ext: string };

/** Voice notes are capped at 5 minutes — hosts can auto-stop at this length. */
export const MAX_RECORDING_SECONDS = 300;

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

function extensionFor(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg")) return "mp3";
  return "webm";
}

/**
 * Voice-note recorder built on MediaRecorder:
 *   start()            → ask for the mic and begin recording
 *   stop("send")       → stop and resolve the clip (Blob + mime + extension)
 *   stop("cancel")     → stop and discard, resolving null
 * The clip is kept in memory until uploaded to the private `chat-media` bucket.
 */
export function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const tick = useRef<number | undefined>(undefined);
  const sink = useRef<((clip: AudioClip | null) => void) | null>(null);
  const discard = useRef(false);

  const cleanup = useCallback(() => {
    window.clearInterval(tick.current);
    tick.current = undefined;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    recorder.current = null;
    setRecording(false);
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (recorder.current) return true;
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone recording is not supported in this browser.");
      return false;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const mime = MIME_CANDIDATES.find(
        (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m)
      );
      const rec = mime ? new MediaRecorder(media, { mimeType: mime }) : new MediaRecorder(media);
      recorder.current = rec;
      chunks.current = [];
      discard.current = false;

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        chunks.current = [];
        const resolve = sink.current;
        sink.current = null;
        const dropped = discard.current;
        cleanup();
        resolve?.(dropped ? null : { blob, mime: type, ext: extensionFor(type) });
      };

      rec.start();
      setRecording(true);
      setSeconds(0);
      tick.current = window.setInterval(
        () => setSeconds((s) => Math.min(MAX_RECORDING_SECONDS, s + 1)),
        1000
      );
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Microphone unavailable";
      setError(/denied|not allowed/i.test(message) ? "Microphone permission denied." : message);
      cleanup();
      return false;
    }
  }, [cleanup]);

  const stop = useCallback(
    (mode: "send" | "cancel"): Promise<AudioClip | null> => {
      return new Promise((resolve) => {
        const rec = recorder.current;
        if (!rec || rec.state === "inactive") {
          cleanup();
          resolve(null);
          return;
        }
        discard.current = mode === "cancel";
        sink.current = resolve;
        rec.stop();
      });
    },
    [cleanup]
  );

  // release the mic if the host unmounts mid-recording
  useEffect(() => cleanup, [cleanup]);

  return { recording, seconds, error, start, stop };
}
