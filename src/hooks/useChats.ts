import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { ChatRow } from "@/types/database";

export type ChatPeer = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
};

export type ChatListItem = ChatRow & { peer?: ChatPeer };

/** Chat list from rpc get_chats(), enriched with the other member's profile. */
export function useChats() {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!silent) setLoading(true);

      const { data, error: rpcError } = await supabase.rpc("get_chats");
      if (!alive.current) return;
      if (rpcError) {
        setError(rpcError.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as ChatRow[];
      const ids = rows.map((r) => r.chat_id);
      const peerMap = new Map<string, ChatPeer>();

      if (ids.length > 0) {
        const { data: members } = await supabase
          .from("conversation_members")
          .select("conversation_id, user_id")
          .in("conversation_id", ids);

        const otherIds = [
          ...new Set((members ?? []).map((m) => m.user_id).filter((id) => id !== user.id)),
        ];

        if (otherIds.length > 0) {
          const { data: users } = await supabase
            .from("users")
            .select("id, username, display_name, avatar_url, status")
            .in("id", otherIds);
          const byId = new Map((users ?? []).map((u) => [u.id, u]));
          for (const m of members ?? []) {
            if (m.user_id === user.id) continue;
            const u = byId.get(m.user_id);
            if (u) peerMap.set(m.conversation_id, u);
          }
        }
      }

      if (!alive.current) return;
      setChats(rows.map((r) => ({ ...r, peer: peerMap.get(r.chat_id) })));
      setError(null);
      setLoading(false);
    },
    [user]
  );

  useEffect(() => {
    alive.current = true;
    void load();

    const channel = supabase
      .channel("chats-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => void load(true)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => void load(true)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations" },
        () => void load(true)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users" },
        ({ new: row }) => {
          const peer = row as ChatPeer;
          setChats((prev) =>
            prev.map((c) => (c.peer?.id === peer.id ? { ...c, peer: { ...c.peer, ...peer } } : c))
          );
        }
      )
      .subscribe();

    return () => {
      alive.current = false;
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return { chats, loading, error, reload: load };
}
