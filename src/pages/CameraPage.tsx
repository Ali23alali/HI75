import { useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { BottomNav } from "@/components/layout/BottomNav";
import { CameraCapture, type Capture } from "@/components/CameraCapture";
import { StoryComposer } from "@/components/StoryComposer";

/** Camera-first status page: the live camera opens on entry; this page is the fallback. */
export default function CameraPage() {
  const [cameraOpen, setCameraOpen] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [capture, setCapture] = useState<Capture | null>(null);

  function handleCapture(next: Capture) {
    setCapture(next);
    setCameraOpen(false);
    setComposerOpen(true);
  }

  return (
    <PhoneFrame>
      <div className="flex flex-1 flex-col">
        <header className="safe-top px-6 pb-2">
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted">hi · status</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">Add to your status</h1>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8">
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            aria-label="Open camera"
            className="relative grid size-56 place-items-center outline-none"
          >
            <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-accent/30 via-[#5aa2ff]/10 to-transparent blur-2xl" />
            <span className="absolute inset-4 rounded-full border border-line" />
            <span className="absolute inset-0 animate-pulse-ring rounded-full" />
            <Camera size={44} className="relative text-accent" />
          </button>
          <p className="text-sm text-ink/85">Photos and videos vanish after 24 hours.</p>
          <p className="max-w-[280px] text-center text-[12px] text-muted">
            Take a live photo or record a video with the camera — or upload from your gallery.
          </p>
        </div>

        <div className="safe-bottom space-y-3 px-6 pb-28 pt-8">
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-pill bg-strong text-[15px] font-semibold text-strong-fg shadow-[0_16px_34px_-14px_rgba(11,11,12,0.5)] transition active:scale-[0.98]"
          >
            <Camera size={18} /> Open camera
          </button>
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-pill border border-line bg-surface text-[15px] font-medium text-ink/90 transition active:scale-[0.98]"
          >
            <ImagePlus size={18} /> Upload photo or video
          </button>
        </div>
      </div>

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCapture}
        onUpload={() => {
          setCameraOpen(false);
          setComposerOpen(true);
        }}
      />
      <StoryComposer
        open={composerOpen}
        capture={capture}
        onClose={() => {
          setComposerOpen(false);
          setCapture(null);
        }}
        onShared={() => setCapture(null)}
        onRetake={() => {
          setComposerOpen(false);
          setCapture(null);
          setCameraOpen(true);
        }}
        onOpenCamera={() => {
          setComposerOpen(false);
          setCameraOpen(true);
        }}
      />
      <BottomNav onCamera={() => setCameraOpen(true)} />
    </PhoneFrame>
  );
}
