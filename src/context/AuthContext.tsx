import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isConfigured } from "@/lib/supabase";
import type { PresenceStatus } from "@/lib/presence";
import type { UserRow } from "@/types/database";

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: UserRow | null;
  loading: boolean;
  configured: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Optimistically persist the user's presence status; resolves to an error message or null. */
  updateStatus: (status: PresenceStatus) => Promise<string | null>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const loadProfile = useCallback(async (user: User | null) => {
    if (!user) {
      if (mounted.current) setProfile(null);
      return;
    }
    // The signup trigger creates the row; allow a brief moment for it.
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (!mounted.current) return;
      if (data) {
        setProfile(data);
        return;
      }
      if (error && error.code !== "PGRST116") {
        console.warn("[hi] profile load failed", error.message);
      }
      await new Promise((r) => setTimeout(r, 350));
    }
    if (mounted.current) setProfile(null);
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted.current) return;
      setSession(data.session);
      setLoading(false);
      void loadProfile(data.session?.user ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted.current) return;
      setSession(next);
      setLoading(false);
      void loadProfile(next?.user ?? null);
    });

    return () => {
      mounted.current = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Live sync of this user's own row across devices (status, name, avatar…).
  useEffect(() => {
    if (!isConfigured) return;
    const uid = session?.user?.id;
    if (!uid) return;
    const channel = supabase
      .channel(`profile-${uid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users", filter: `id=eq.${uid}` },
        ({ new: row }) => {
          if (!mounted.current) return;
          setProfile((prev) => (prev ? { ...prev, ...(row as UserRow) } : prev));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user ?? null);
  }, [loadProfile, session?.user]);

  const updateStatus = useCallback(
    async (status: PresenceStatus): Promise<string | null> => {
      const uid = session?.user?.id;
      if (!uid) return "Not signed in.";
      const previous = profile?.status ?? "online";
      // Optimistic: reflect the choice immediately, roll back if the write fails.
      setProfile((prev) => (prev ? { ...prev, status } : prev));
      const { error } = await supabase.from("users").update({ status }).eq("id", uid);
      if (error) {
        setProfile((prev) => (prev ? { ...prev, status: previous } : prev));
        return error.message;
      }
      return null;
    },
    [session?.user?.id, profile?.status]
  );

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      configured: isConfigured,
      signOut,
      refreshProfile,
      updateStatus,
    }),
    [session, profile, loading, signOut, refreshProfile, updateStatus]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
