import { useCallback, useEffect, useRef, useState } from "react";
import { startRingtone, stopRingtone } from "@/lib/ringtone";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { CallMode } from "@/components/CallOverlay";

export type CallTarget = {
  id: string;
  name: string;
  avatarUrl: string;
  seed?: string;
};

export type ActiveCall = { target: CallTarget; mode: CallMode };

/**
 * The app's simulated call experience, shared by ChatPage and the Calls tab:
 * the ringtone starts synchronously on tap (autoplay-safe), the call rings
 * until End, and every call is recorded in public.calls right away so the
 * history survives reloads. On End the ring duration is written back.
 */
export function useSimulatedCall() {
  const { user } = useAuth();
  const [active, setActive] = useState<ActiveCall | null>(null);
  const startedAt = useRef(0);
  const rowId = useRef<string | null>(null);

  const beginCall = useCallback(
    (target: CallTarget, mode: CallMode) => {
      if (!user) return;
      startRingtone();
      startedAt.current = Date.now();
      rowId.current = null;
      setActive({ target, mode });

      // record the call immediately — the callee sees it as missed
      void supabase
        .from("calls")
        .insert({ caller_id: user.id, callee_id: target.id, mode })
        .select("id")
        .single()
        .then(({ data, error }) => {
          if (error) {
            if (import.meta.env.DEV) console.warn("[calls] history not saved:", error.message);
            return;
          }
          rowId.current = data?.id ?? null;
        });
    },
    [user]
  );

  const endCall = useCallback(() => {
    stopRingtone();
    setActive(null);
    const id = rowId.current;
    const seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    rowId.current = null;
    if (id) {
      void supabase
        .from("calls")
        .update({ duration_seconds: seconds })
        .eq("id", id)
        .then(({ error }) => {
          if (error && import.meta.env.DEV) {
            console.warn("[calls] duration not saved:", error.message);
          }
        });
    }
  }, []);

  // never leave a ringtone running if the host unmounts mid-ring
  useEffect(() => () => stopRingtone(), []);

  return { active, beginCall, endCall };
}
