import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export type TypingEvent = {
  conversation_id: string;
  user_id: string;
  name: string;
};

/**
 * Typing signals travel over a single Realtime broadcast channel — they are
 * never written to the database. Nobody receives their own signals
 * (`self: false`), and only one page uses the channel at a time.
 */
export function useTypingChannel(
  selfId: string | undefined,
  onTyping: (event: TypingEvent) => void
) {
  const [ready, setReady] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const handler = useRef(onTyping);
  handler.current = onTyping;

  useEffect(() => {
    if (!selfId) return;
    const channel = supabase.channel("hi-typing", {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "typing" }, (msg) => {
        const payload = msg.payload as TypingEvent | undefined;
        if (payload?.conversation_id && payload.user_id && payload.user_id !== selfId) {
          handler.current(payload);
        }
      })
      .subscribe((status) => setReady(status === "SUBSCRIBED"));

    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      setReady(false);
      void supabase.removeChannel(channel);
    };
  }, [selfId]);

  return useCallback(
    (event: TypingEvent) => {
      if (!ready || !channelRef.current) return;
      void channelRef.current.send({ type: "broadcast", event: "typing", payload: event });
    },
    [ready]
  );
}
