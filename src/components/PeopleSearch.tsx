import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/ui/Avatar";
import { fallbackAvatar } from "@/lib/avatars";
import type { UserRow } from "@/types/database";

/** People search pill (by username / display name) with a "start a chat" action. */
export function PeopleSearch() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(async () => {
      const { data, error: searchError } = await supabase
        .from("users")
        .select("*")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq("id", user?.id ?? "")
        .limit(8);
      if (!alive) return;
      if (searchError) setError(searchError.message);
      else {
        setResults(data ?? []);
        setError(null);
      }
    }, 220);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query, user?.id]);

  async function startChat(other: string) {
    setBusyId(other);
    const { data, error: rpcError } = await supabase.rpc("start_direct_chat", { other });
    setBusyId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    navigate(`/messages/${data}`);
  }

  return (
    <div className="relative min-w-0 flex-1">
      <div className="flex h-11 items-center gap-2 rounded-pill border border-line bg-surface px-4 shadow-[0_14px_30px_-22px_rgba(16,17,20,0.6)]">
        <svg
          viewBox="0 0 24 24"
          className="size-4 shrink-0 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people…"
          className="w-full bg-transparent text-[13.5px] outline-none"
          aria-label="Search people"
        />
      </div>

      {(results.length > 0 || error) && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-[22px] border border-line bg-surface p-1.5 shadow-[0_28px_70px_-30px_rgba(16,17,20,0.5)]">
          {error && <p className="px-3 py-2.5 text-xs text-red-600">{error}</p>}
          {results.map((person) => (
            <div
              key={person.id}
              className="flex items-center gap-2.5 rounded-[16px] px-2.5 py-2 transition hover:bg-surface-2"
            >
              <Avatar
                src={person.avatar_url || fallbackAvatar(person.id)}
                name={person.display_name || person.username}
                seed={person.id}
                size={34}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{person.display_name || person.username}</p>
                <p className="truncate text-[11.5px] text-muted">@{person.username}</p>
              </div>
              <button
                type="button"
                onClick={() => void startChat(person.id)}
                disabled={busyId === person.id}
                className="shrink-0 rounded-pill bg-strong px-3 py-1.5 text-[11.5px] font-semibold text-strong-fg transition active:scale-95 disabled:opacity-50"
              >
                {busyId === person.id ? "…" : "Chat"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
