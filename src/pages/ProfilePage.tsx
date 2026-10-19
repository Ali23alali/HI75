import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, ChevronRight, LogOut, Moon, Sparkles, Sun } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/ui/Logo";
import { Spinner } from "@/components/ui/Spinner";
import { BottomNav } from "@/components/layout/BottomNav";
import { fallbackAvatar } from "@/lib/avatars";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { profile, user, refreshProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(profile?.display_name ?? "");
    setBio(profile?.bio ?? "");
  }, [profile?.id, profile?.display_name, profile?.bio]);

  const dirty = name !== (profile?.display_name ?? "") || bio !== (profile?.bio ?? "");

  async function save() {
    if (!user || saving) return;
    setSaving(true);
    setNotice(null);
    const { error } = await supabase
      .from("users")
      .update({ display_name: name.trim() || null, bio: bio.trim() || null })
      .eq("id", user.id);
    if (!error) await refreshProfile();
    setSaving(false);
    setNotice(error ? error.message : "Saved.");
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploading(true);
    setNotice(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: upErr2 } = await supabase
        .from("users")
        .update({ avatar_url: pub.publicUrl })
        .eq("id", user.id);
      if (upErr2) throw upErr2;
      await refreshProfile();
      setNotice("Photo updated.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function openAi() {
    const { data, error } = await supabase.rpc("start_ai_chat");
    if (error) {
      setNotice(error.message);
      return;
    }
    navigate(`/messages/${data}`);
  }

  async function handleSignOut() {
    await signOut();
    navigate("/welcome", { replace: true });
  }

  const displayName = profile?.display_name || profile?.username || "You";

  return (
    <PhoneFrame>
      <div className="flex flex-1 flex-col overflow-y-auto pb-28">
        <header className="safe-top px-6 pb-2">
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted">hi · you</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">Profile</h1>
        </header>

        <div className="flex flex-col items-center px-6 pt-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative"
            aria-label="Change photo"
          >
            <Avatar
              src={profile?.avatar_url || fallbackAvatar(profile?.id ?? "me")}
              name={displayName}
              seed={profile?.id}
              size={104}
              className="ring-2 ring-line"
            />
            <span className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full border-2 border-canvas bg-accent text-white">
              {uploading ? <Spinner className="size-3.5" /> : <Camera size={14} />}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={uploadAvatar}
          />

          <p className="mt-4 text-[18px] font-semibold">{displayName}</p>
          <p className="text-[13px] text-muted">@{profile?.username ?? "you"}</p>
          <p className="text-[12px] text-muted/70">{user?.email}</p>
        </div>

        <div className="mt-7 space-y-3 px-6">
          <label className="block">
            <span className="mb-1.5 block px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Display name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="h-14 w-full rounded-2xl border border-line bg-surface px-4 text-[15px] text-ink outline-none focus:border-ink/20"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Bio
            </span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A line about you"
              rows={3}
              maxLength={160}
              className="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3.5 text-[15px] text-ink outline-none focus:border-ink/20"
            />
          </label>

          {notice && (
            <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-[13px] text-ink/80">
              {notice}
            </p>
          )}

          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="flex h-14 w-full items-center justify-center rounded-pill bg-strong text-[15px] font-semibold text-strong-fg transition disabled:opacity-40"
          >
            {saving ? <Spinner /> : "Save changes"}
          </button>
        </div>

        <div className="mt-7 px-6">
          <h2 className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/80">
            Settings
          </h2>
          <div className="rounded-[24px] border border-line bg-surface p-4 shadow-[0_20px_50px_-38px_rgba(16,17,20,0.45)]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[14px] font-semibold">
                  {theme === "dark" ? <Moon size={14} className="text-accent" /> : <Sun size={14} className="text-accent" />}
                  Appearance
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-muted">
                  Switch the whole app between light and dark. Saved on this device.
                </p>
              </div>
              <div
                role="group"
                aria-label="Theme"
                className="flex shrink-0 rounded-pill border border-line bg-surface-2 p-1"
              >
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  aria-pressed={theme === "light"}
                  className={cn(
                    "flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] font-semibold transition active:scale-95",
                    theme === "light"
                      ? "bg-strong text-strong-fg shadow-[0_8px_18px_-10px_rgba(16,17,20,0.5)]"
                      : "text-muted"
                  )}
                >
                  <Sun size={13} /> Light
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  aria-pressed={theme === "dark"}
                  className={cn(
                    "flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] font-semibold transition active:scale-95",
                    theme === "dark"
                      ? "bg-strong text-strong-fg shadow-[0_8px_18px_-10px_rgba(16,17,20,0.5)]"
                      : "text-muted"
                  )}
                >
                  <Moon size={13} /> Dark
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 px-6">
          <button
            type="button"
            onClick={() => void openAi()}
            className="flex w-full items-center gap-4 rounded-[24px] border border-accent/25 bg-gradient-to-r from-accent/20 to-surface p-4 text-left transition active:scale-[0.99]"
          >
            <Logo size={44} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold">
                hi AI <Sparkles size={13} className="text-accent" />
              </p>
              <p className="text-[12px] text-muted">Your assistant, in a chat.</p>
            </div>
            <ChevronRight size={18} className="text-muted" />
          </button>
        </div>

        <div className="mt-auto px-6 pt-8">
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-pill border border-line bg-surface text-[15px] font-medium text-red-600 transition active:scale-[0.98] dark:text-red-400"
          >
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </div>

      <BottomNav />
    </PhoneFrame>
  );
}
