import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { CallRow } from "@/types/database";

export type CallPeer = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
};

export type CallKind = "outgoing" | "incoming" | "missed";

export type CallListItem = CallRow & {
  kind: CallKind;
  /** The other participant (null if the account was deleted). */
  peer: CallPeer | null;
};

/** Call history for the signed-in user, live-updated over Realtime. */
export function useCalls() {
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!silent) setLoading(true);

      const { data, error: fetchError } = await supabase
        .from("calls")
        .select("*")
        .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!alive.current) return;
      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as CallRow[];
      const peerIds = [
        ...new Set(rows.map((r) => (r.caller_id === user.id ? r.callee_id : r.caller_id))),
      ];

      let byId = new Map<string, CallPeer>();
      if (peerIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, username, display_name, avatar_url, status")
          .in("id", peerIds);
        byId = new Map((users ?? []).map((u) => [u.id, u as CallPeer]));
      }
      if (!alive.current) return;

      setCalls(
        rows.map((r) => {
          const kind: CallKind =
            r.caller_id === user.id ? "outgoing" : r.answered ? "incoming" : "missed";
          const peerId = r.caller_id === user.id ? r.callee_id : r.caller_id;
          return { ...r, kind, peer: byId.get(peerId) ?? null };
        })
      );
      setError(null);
      setLoading(false);
    },
    [user]
  );

  useEffect(() => {
    alive.current = true;
    void load();

    const channel = supabase
      .channel("calls-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "calls" }, () => {
        void load(true);
      })
      .subscribe();

    return () => {
      alive.current = false;
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return { calls, loading, error, reload: load };
}
