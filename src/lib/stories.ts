import { supabase } from "@/lib/supabase";

/** Extract the storage object path from a public story URL. */
export function storyStoragePath(url?: string | null): string | null {
  if (!url) return null;
  const clean = url.split("?")[0];
  const m = /\/storage\/v1\/object\/(?:public|sign)\/stories\/(.+)$/.exec(clean);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Delete story rows (RLS: your own only — `story_views` cascades) and
 * best-effort clean up their files. Returns an error message on failure.
 */
export async function deleteStories(rows: { id: string; media_url: string | null }[]): Promise<string | null> {
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return null;
  const { error } = await supabase.from("stories").delete().in("id", ids);
  if (error) return error.message;
  const paths = rows.map((r) => storyStoragePath(r.media_url)).filter((p): p is string => Boolean(p));
  if (paths.length > 0) void supabase.storage.from("stories").remove(paths).catch(() => {});
  return null;
}
