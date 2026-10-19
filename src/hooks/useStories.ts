import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { StoryRow, StoryViewRow } from "@/types/database";

export type StoryGroup = {
  user: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  stories: StoryRow[];
  /** ids of this group's stories the viewer has already seen */
  viewedIds: string[];
  viewed: boolean;
  isOwn: boolean;
};

type StoryWithUser = StoryRow & {
  users: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
};

/** Active (non-expired) stories grouped by author, with per-story viewed state. */
export function useStories() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!user) return;
    // only show the skeleton on the very first load — realtime refreshes keep the list stable
    if (!loadedOnce.current) setLoading(true);
    const [{ data: stories, error }, { data: views }] = await Promise.all([
      supabase
        .from("stories")
        .select("*, users!stories_user_id_fkey(id, username, display_name, avatar_url)")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true }),
      supabase.from("story_views").select("story_id, viewer_id").eq("viewer_id", user.id),
    ]);

    if (!alive.current) return;
    if (error) {
      console.warn("[hi] stories", error.message);
      setGroups([]);
      loadedOnce.current = true;
      setLoading(false);
      return;
    }

    const seenIds = new Set((views ?? []).map((v: Pick<StoryViewRow, "story_id">) => v.story_id));
    const map = new Map<string, StoryGroup>();
    for (const row of (stories ?? []) as StoryWithUser[]) {
      const author = row.users;
      if (!author) continue;
      const existing = map.get(row.user_id);
      if (existing) existing.stories.push(row);
      else
        map.set(row.user_id, {
          user: author,
          stories: [row],
          viewedIds: [],
          viewed: false,
          isOwn: row.user_id === user.id,
        });
    }
    const result = [...map.values()].map((g) => ({
      ...g,
      viewedIds: g.stories.filter((s) => seenIds.has(s.id)).map((s) => s.id),
      viewed: g.stories.every((s) => seenIds.has(s.id)),
    }));
    result.sort((a, b) => Number(b.isOwn) - Number(a.isOwn));
    setGroups(result);
    loadedOnce.current = true;
    setLoading(false);
  }, [user]);

  useEffect(() => {
    alive.current = true;
    void load();
    const channel = supabase
      .channel("stories-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, () => void load())
      .subscribe();
    return () => {
      alive.current = false;
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return { groups, loading, reload: load };
}

export async function markStoryViewed(storyId: string, viewerId: string) {
  await supabase.from("story_views").upsert(
    { story_id: storyId, viewer_id: viewerId },
    { onConflict: "story_id,viewer_id", ignoreDuplicates: true }
  );
}
