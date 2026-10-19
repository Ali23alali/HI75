import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, MessageCircle, Plus, Search, Sparkles, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/ui/Logo";
import { BottomNav } from "@/components/layout/BottomNav";
import { fallbackAvatar } from "@/lib/avatars";
import { cn } from "@/lib/utils";
import type { UserRow } from "@/types/database";

export default function DiscoverPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<UserRow[]>([]);
  const [statuses, setStatuses] = useState<Map<string, string>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const [{ data: users, error: usersError }, { data: contacts }] = await Promise.all([
        supabase
          .from("users")
          .select("*")
          .neq("id", user.id)
          .order("username", { ascending: true })
          .limit(60),
        supabase.from("contacts").select("friend_id, status").eq("user_id", user.id),
      ]);
      if (!alive) return;
      if (usersError) setError(usersError.message);
      setPeople(users ?? []);
      setStatuses(new Map((contacts ?? []).map((c) => [c.friend_id, c.status])));
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) =>
        p.username.toLowerCase().includes(q) ||
        (p.display_name ?? "").toLowerCase().includes(q)
    );
  }, [people, query]);

  async function openAi() {
    if (aiBusy) return;
    setAiBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("start_ai_chat");
    setAiBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    navigate(`/messages/${data}`);
  }

  async function startChat(other: string) {
    setBusyId(other);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("start_direct_chat", { other });
    setBusyId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    navigate(`/messages/${data}`);
  }

  async function addContact(other: string) {
    if (!user) return;
    setBusyId(other);
    setError(null);
    const { error: insertError } = await supabase
      .from("contacts")
      .insert({ user_id: user.id, friend_id: other, status: "pending" });
    setBusyId(null);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setStatuses((prev) => new Map(prev).set(other, "pending"));
  }

  return (
    <PhoneFrame>
      <div className="flex flex-1 flex-col overflow-y-auto pb-28">
        <header className="safe-top px-6 pb-3">
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted">hi · discover</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">Find your people</h1>
        </header>

        <div className="px-6">
          <button
            type="button"
            onClick={() => void openAi()}
            disabled={aiBusy}
            className="group relative w-full overflow-hidden rounded-[28px] border border-accent/25 bg-gradient-to-br from-accent/15 via-surface to-surface p-5 text-left transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <Logo size={52} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[15px] font-semibold">
                  hi AI <Sparkles size={14} className="text-accent" />
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-muted">
                  Drafts, plans and answers — right inside your chat.
                </p>
              </div>
              <span className="rounded-pill bg-accent px-4 py-2 text-[12px] font-semibold text-white">
                {aiBusy ? "…" : "Chat"}
              </span>
            </div>
          </button>
        </div>

        <div className="mt-5 px-6">
          <div className="flex items-center gap-2 rounded-pill border border-line bg-surface px-4 py-3">
            <Search size={15} className="shrink-0 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people by @username"
              aria-label="Search people"
              className="w-full bg-transparent text-[14px] outline-none"
            />
          </div>
        </div>

        <section className="mt-5 px-6">
          <h2 className="mb-2 text-[13px] font-medium text-ink/70">
            {query ? "Results" : "People on hi"}
          </h2>

          {error && (
            <p className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </p>
          )}

          {filtered.length === 0 && (
            <p className="rounded-3xl border border-line bg-surface/60 px-6 py-8 text-center text-sm text-muted">
              Nobody found for “{query}”.
            </p>
          )}

          <ul className="space-y-1">
            {filtered.map((person) => {
              const status = statuses.get(person.id);
              return (
                <li key={person.id} className="flex items-center gap-3 py-2.5">
                  <Avatar
                    src={person.avatar_url || fallbackAvatar(person.id)}
                    name={person.display_name || person.username}
                    seed={person.id}
                    size={44}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">
                      {person.display_name || person.username}
                    </p>
                    <p className="truncate text-[12px] text-muted">
                      @{person.username}
                      {person.bio ? ` · ${person.bio}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {status === "accepted" ? (
                      <span className="grid size-9 place-items-center rounded-full bg-surface text-accent" title="Contact">
                        <Check size={16} />
                      </span>
                    ) : status === "pending" ? (
                      <span className="rounded-pill border border-line px-3 py-1.5 text-[11px] text-muted">
                        Requested
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void addContact(person.id)}
                        disabled={busyId === person.id}
                        aria-label={`Add ${person.username}`}
                        className={cn(
                          "grid size-9 place-items-center rounded-full border border-line bg-surface text-ink/70 transition hover:text-ink",
                          busyId === person.id && "opacity-50"
                        )}
                      >
                        <UserPlus size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void startChat(person.id)}
                      disabled={busyId === person.id}
                      className="flex items-center gap-1.5 rounded-pill bg-accent px-3.5 py-2 text-[12px] font-semibold text-white transition disabled:opacity-50"
                    >
                      <MessageCircle size={13} /> Chat
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="mt-6 flex justify-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted/70">
            <Plus size={12} /> You are @{profile?.username ?? "…"}
          </span>
        </div>
      </div>

      <BottomNav />
    </PhoneFrame>
  );
}
