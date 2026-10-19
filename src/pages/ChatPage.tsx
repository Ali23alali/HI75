import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, ImagePlus, Mic, MoreVertical, Phone, Send, Sparkles, Trash2, UserRound, Users, Video, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useTypingChannel } from "@/hooks/useTyping";
import { useLongPress } from "@/hooks/useLongPress";
import { useSimulatedCall } from "@/hooks/useSimulatedCall";
import { MAX_RECORDING_SECONDS, useAudioRecorder } from "@/hooks/useAudioRecorder";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { Avatar } from "@/components/ui/Avatar";
import { FloatingSheet } from "@/components/ui/FloatingSheet";
import { Logo } from "@/components/ui/Logo";
import { Spinner } from "@/components/ui/Spinner";
import { StatusDot, STATUS_META } from "@/components/ui/StatusMenu";
import { SignedMedia } from "@/components/ChatImage";
import { CallOverlay } from "@/components/CallOverlay";
import { CameraCapture, type Capture } from "@/components/CameraCapture";
import { fallbackAvatar } from "@/lib/avatars";
import { describeAiFailure, mockAiReply, postAiReply } from "@/lib/aiReply";
import { toPresenceStatus } from "@/lib/presence";
import { clockTime, cn, dayLabel, formatClock } from "@/lib/utils";
import type { ConversationRow, MessageRow, UserRow } from "@/types/database";

type Peer = Pick<UserRow, "id" | "username" | "display_name" | "avatar_url" | "status">;

export default function ChatPage() {
  const { conversationId = "" } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [convo, setConvo] = useState<ConversationRow | null>(null);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [clearedAt, setClearedAt] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<MessageRow | null>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<"everyone" | "me" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingMessage, setDeletingMessage] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<number | undefined>(undefined);
  const lastTypingSent = useRef(0);
  const lastMessageCount = useRef(0);
  const { active: activeCall, beginCall, endCall } = useSimulatedCall();
  const recorder = useAudioRecorder();

  const isAi = convo?.type === "ai";
  const title = isAi
    ? convo?.title || "hi AI"
    : peer
      ? peer.display_name || peer.username
      : convo?.title || "Chat";
  const subtitle = peerTyping ? (
    <span className="text-accent">typing…</span>
  ) : isAi ? (
    "AI assistant"
  ) : peer ? (
    STATUS_META[toPresenceStatus(peer.status)].label
  ) : (
    "offline"
  );

  const markRead = useCallback(async () => {
    if (!user || !conversationId) return;
    await supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
  }, [conversationId, user]);

  // load conversation, peer and history
  useEffect(() => {
    if (!conversationId || !user) return;
    let alive = true;

    (async () => {
      setLoading(true);
      setNotFound(false);
      setNotice(null);
      setHiddenIds([]);
      setClearedAt(null);
      setActionOpen(false);
      setActionMessage(null);
      setHeaderMenuOpen(false);
      setConfirmClear(false);

      const { data: c } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .maybeSingle();
      if (!alive) return;
      if (!c) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setConvo(c);

      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id, hidden_message_ids, cleared_at")
        .eq("conversation_id", conversationId);
      const me = (members ?? []).find((m) => m.user_id === user.id);
      if (alive) {
        setHiddenIds(me?.hidden_message_ids ?? []);
        setClearedAt(me?.cleared_at ?? null);
      }
      const otherId = (members ?? []).map((m) => m.user_id).find((id) => id !== user.id);
      if (otherId) {
        const { data: u } = await supabase
          .from("users")
          .select("id, username, display_name, avatar_url, status")
          .eq("id", otherId)
          .maybeSingle();
        if (alive && u) setPeer(u);
      }

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (!alive) return;
      setMessages((msgs ?? []) as MessageRow[]);
      setLoading(false);
      void markRead();
    })();

    return () => {
      alive = false;
    };
  }, [conversationId, user, markRead]);

  // realtime: new + edited messages
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        ({ new: row }) => {
          const m = row as MessageRow;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== user?.id) {
            void markRead();
            setPeerTyping(false);
            if (m.is_ai) setAiThinking(false);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        ({ new: row }) => {
          const m = row as MessageRow;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users" },
        ({ new: row }) => {
          const u = row as Peer;
          setPeer((prev) => (prev && prev.id === u.id ? { ...prev, ...u } : prev));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, user, markRead]);

  // typing over broadcast only — never stored
  const sendTyping = useTypingChannel(user?.id, (t) => {
    if (t.conversation_id !== conversationId) return;
    setPeerTyping(true);
    window.clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(() => setPeerTyping(false), 2600);
  });

  useEffect(() => {
    // Only follow the conversation when it grows — deleting/hiding a message
    // must not yank the reader down to the bottom.
    if (messages.length >= lastMessageCount.current) {
      bottomRef.current?.scrollIntoView({
        behavior: messages.length > 1 ? "smooth" : "auto",
        block: "end",
      });
    }
    lastMessageCount.current = messages.length;
  }, [messages.length, peerTyping, aiThinking]);

  function onDraftChange(value: string) {
    setDraft(value);
    const now = Date.now();
    if (value.trim() && now - lastTypingSent.current > 1500) {
      lastTypingSent.current = now;
      sendTyping({
        conversation_id: conversationId,
        user_id: user?.id ?? "",
        name: profile?.display_name || profile?.username || "Someone",
      });
    }
  }

  async function send() {
    const body = draft.trim();
    if (!body || !user || sending || !conversationId) return;
    setSending(true);
    setDraft("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: user.id, body })
      .select()
      .single();
    setSending(false);
    if (error) {
      setNotice(error.message);
      setDraft(body);
      return;
    }
    setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data]));
    if (isAi) void askAi(body);
  }

  /** In case realtime delivery lags, pull anything new for this conversation. */
  async function pullMessages() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (data) {
      setMessages((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const extra = (data as MessageRow[]).filter((m) => !seen.has(m.id));
        return extra.length ? [...prev, ...extra] : prev;
      });
    }
  }

  /**
   * Ask the ai-reply Edge Function for a reply. When the function is missing
   * (not deployed / no key / network), fall back to a clearly-labelled demo
   * reply so the chat keeps working — and surface the exact cause in the
   * notice banner.
   */
  async function askAi(userText: string) {
    setAiThinking(true);
    setNotice(null);
    const guard = window.setTimeout(() => setAiThinking(false), 90_000);
    let failure: string | null = null;

    try {
      const { data, error } = await supabase.functions.invoke("ai-reply", {
        body: { conversation_id: conversationId },
      });
      if (error) {
        failure = await describeAiFailure(error);
      } else if (
        data &&
        typeof data === "object" &&
        "error" in data &&
        (data as { error?: unknown }).error
      ) {
        failure = String((data as { error: unknown }).error);
      }
    } catch (err) {
      failure = await describeAiFailure(err);
    }

    try {
      if (failure) {
        if (import.meta.env.DEV) {
          console.warn(`[hi AI] falling back to a demo reply — ${failure}`);
        }
        // keep the typing bubble up briefly so the flow feels alive
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        const text = mockAiReply(userText);
        const saveError = await postAiReply(conversationId, text);
        if (saveError) {
          // Last resort: show the reply even if it could not be stored.
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              conversation_id: conversationId,
              sender_id: null,
              body: text,
              media_url: null,
              media_type: null,
              is_ai: true,
              reply_to: null,
              created_at: new Date().toISOString(),
              deleted_at: null,
            },
          ]);
          setNotice(
            `hi AI is offline — demo reply shown but not saved. Cause: ${failure}. Save failed: ${saveError}.`
          );
        } else {
          setNotice(
            `hi AI is offline — replied in demo mode. Cause: ${failure}. Deploy the ai-reply function and set OPENAI_API_KEY (README → AI assistant).`
          );
        }
      }
      await pullMessages();
    } finally {
      window.clearTimeout(guard);
      setAiThinking(false);
    }
  }

  /** Upload one blob/file into the private bucket and post it as a message. */
  async function uploadMedia(blob: Blob, mime: string, name?: string) {
    if (!user || !conversationId) return;
    const isVideo = mime.startsWith("video/");
    const isAudio = mime.startsWith("audio/");
    const fromName = name?.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
    const fromMime = mime.split("/")[1]?.split(";")[0]?.replace(/[^a-z0-9]/g, "");
    const ext = fromName || fromMime || (isVideo ? "webm" : isAudio ? "webm" : "jpg");
    const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("chat-media")
      .upload(path, blob, {
        contentType: mime || (isVideo ? "video/webm" : isAudio ? "audio/webm" : "image/jpeg"),
        upsert: false,
      });
    if (upErr) throw upErr;
    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        media_url: path,
        media_type: isVideo ? "video" : isAudio ? "audio" : "image",
      })
      .select()
      .single();
    if (error) throw error;
    setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data]));
  }

  /** Stop the voice recording and send it as an audio message. */
  async function sendVoice() {
    if (!user || !conversationId || uploading) return;
    const clip = await recorder.stop("send");
    if (!clip) return;
    setUploading(true);
    setNotice(null);
    try {
      await uploadMedia(clip.blob, clip.mime, `voice.${clip.ext}`);
      if (isAi) void askAi("[voice]");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not send the voice note.");
    } finally {
      setUploading(false);
    }
  }

  function cancelVoice() {
    void recorder.stop("cancel");
  }

  // surface microphone failures (permission denied, unsupported browser, …)
  useEffect(() => {
    if (recorder.error) setNotice(recorder.error);
  }, [recorder.error]);

  // hard cap: stop and send automatically at 5 minutes
  useEffect(() => {
    if (recorder.recording && recorder.seconds >= MAX_RECORDING_SECONDS) void sendVoice();
  }, [recorder.recording, recorder.seconds]);

  const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

  /** Send a batch picked from the gallery — photos and clips, one after another. */
  async function onPickMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !user || !conversationId || uploading) return;
    const allowed = files.filter((f) => f.size <= MAX_MEDIA_BYTES);
    if (allowed.length < files.length) {
      setNotice("Attachments must be 50 MB or smaller — the rest were skipped.");
    } else {
      setNotice(null);
    }
    if (!allowed.length) return;
    setUploading(true);
    try {
      for (const file of allowed) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        const guessedVideo = ["mp4", "webm", "mov", "m4v", "ogv"].includes(ext);
        const mime =
          file.type ||
          (guessedVideo ? `video/${ext === "mov" ? "quicktime" : ext}` : "image/jpeg");
        await uploadMedia(file, mime, file.name);
      }
      if (isAi) {
        const anyVideo = allowed.some((f) => {
          const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
          return f.type.startsWith("video/") || ["mp4", "webm", "mov", "m4v", "ogv"].includes(ext);
        });
        void askAi(anyVideo ? "[video]" : "[photo]");
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  /** Straight from the in-app camera to the conversation. */
  async function onCameraCapture({ blob, mime }: Capture) {
    setCameraOpen(false);
    if (!user || !conversationId) return;
    setUploading(true);
    setNotice(null);
    try {
      await uploadMedia(blob, mime);
      if (isAi) void askAi(mime.startsWith("video/") ? "[video]" : "[photo]");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const visibleMessages = messages.filter((m) => {
    if (m.deleted_at) return false;
    if (hiddenIds.includes(m.id)) return false;
    if (clearedAt && +new Date(m.created_at) <= +new Date(clearedAt)) return false;
    return true;
  });
  const actionIsMine = actionMessage?.sender_id === user?.id;
  const actionPreview = actionMessage
    ? actionMessage.body?.trim() ||
      (actionMessage.media_type === "video"
        ? "Video"
        : actionMessage.media_url
          ? "Photo"
          : "Message")
    : "";

  function openMessageActions(m: MessageRow) {
    setActionMessage(m);
    setConfirmDelete(null);
    setActionError(null);
    setActionOpen(true);
  }

  function closeMessageActions() {
    if (deletingMessage) return;
    setActionOpen(false);
    setConfirmDelete(null);
    setActionError(null);
  }

  /** Hide the row for every member, but keep the record (soft delete). */
  async function deleteForEveryone(msg: MessageRow) {
    if (!user || msg.sender_id !== user.id) return;
    const stamp = new Date().toISOString();
    setDeletingMessage(true);
    setActionError(null);
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, deleted_at: stamp } : m)));
    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: stamp })
      .eq("id", msg.id)
      .eq("sender_id", user.id);
    setDeletingMessage(false);
    if (error) {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
      setActionError(error.message);
      return;
    }
    setActionOpen(false);
    setConfirmDelete(null);
  }

  /** Hide the row only for this account (persisted on the membership row). */
  async function deleteForMe(msg: MessageRow) {
    if (!user || !conversationId) return;
    const previous = hiddenIds;
    const next = previous.includes(msg.id) ? previous : [...previous, msg.id];
    setHiddenIds(next);
    setDeletingMessage(true);
    setActionError(null);
    const { error } = await supabase
      .from("conversation_members")
      .update({ hidden_message_ids: next })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
    setDeletingMessage(false);
    if (error) {
      setHiddenIds(previous);
      setActionError(error.message);
      return;
    }
    setActionOpen(false);
    setConfirmDelete(null);
  }

  async function clearChat() {
    if (!user || !conversationId || clearing) return;
    const previousCleared = clearedAt;
    const previousHidden = hiddenIds;
    const now = new Date().toISOString();
    setClearing(true);
    setClearError(null);
    setClearedAt(now);
    setHiddenIds([]);
    const { error } = await supabase
      .from("conversation_members")
      .update({ cleared_at: now, hidden_message_ids: [], last_read_at: now })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
    setClearing(false);
    if (error) {
      setClearedAt(previousCleared);
      setHiddenIds(previousHidden);
      setClearError(error.message);
      return;
    }
    setHeaderMenuOpen(false);
    setConfirmClear(false);
  }

  if (notFound) {
    return (
      <PhoneFrame>
        <div className="grid flex-1 place-items-center px-8 text-center">
          <div>
            <p className="text-sm font-medium">This conversation isn’t available.</p>
            <button
              type="button"
              onClick={() => navigate("/messages")}
              className="mt-4 rounded-pill bg-strong px-5 py-2.5 text-sm font-semibold text-strong-fg"
            >
              Back to messages
            </button>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame className="h-dvh">
      <header className="safe-top z-10 flex items-center gap-3 border-b border-line/60 bg-surface/85 px-3 pb-3 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate("/messages")}
          aria-label="Back"
          className="grid size-9 place-items-center rounded-full text-ink/80 transition hover:bg-surface-2"
        >
          <ArrowLeft size={20} />
        </button>
        {!isAi && peer ? (
          <button
            type="button"
            onClick={() => navigate(`/u/${peer.id}`)}
            aria-label={`Open ${title}'s profile`}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-pill text-left transition active:opacity-75"
          >
            <span className="relative shrink-0">
              <Avatar
                src={peer.avatar_url || fallbackAvatar(peer.id)}
                name={title}
                seed={peer.id}
                size={38}
              />
              <StatusDot
                status={toPresenceStatus(peer.status)}
                size={12}
                className="absolute -bottom-0.5 -right-0.5"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{title}</span>
              <span className="block truncate text-[11px] text-muted">{subtitle}</span>
            </span>
          </button>
        ) : (
          <>
            {isAi ? (
              <Logo size={38} />
            ) : (
              <span className="relative shrink-0">
                <Avatar
                  src={fallbackAvatar(conversationId)}
                  name={title}
                  seed={conversationId}
                  size={38}
                />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{title}</p>
              <p className="truncate text-[11px] text-muted">{subtitle}</p>
            </div>
          </>
        )}
        {!isAi && peer && (
          <div className="flex items-center text-ink/70">
            <button
              type="button"
              onClick={() =>
                beginCall(
                  {
                    id: peer.id,
                    name: title,
                    avatarUrl: peer.avatar_url || fallbackAvatar(peer.id),
                    seed: peer.id,
                  },
                  "voice"
                )
              }
              aria-label={`Voice call ${title}`}
              className="grid size-9 place-items-center rounded-full transition hover:bg-surface-2 active:scale-95"
            >
              <Phone size={17} />
            </button>
            <button
              type="button"
              onClick={() =>
                beginCall(
                  {
                    id: peer.id,
                    name: title,
                    avatarUrl: peer.avatar_url || fallbackAvatar(peer.id),
                    seed: peer.id,
                  },
                  "video"
                )
              }
              aria-label={`Video call ${title}`}
              className="grid size-9 place-items-center rounded-full transition hover:bg-surface-2 active:scale-95"
            >
              <Video size={18} />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setConfirmClear(false);
            setClearError(null);
            setHeaderMenuOpen(true);
          }}
          aria-label="Chat options"
          aria-haspopup="dialog"
          className="grid size-9 shrink-0 place-items-center rounded-full text-ink/70 transition hover:bg-surface-2 active:scale-95"
        >
          <MoreVertical size={19} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-3 pt-4">
        {loading ? (
          <div className="grid h-full place-items-center">
            <Spinner tone="dark" />
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
            {isAi ? (
              <Logo size={72} />
            ) : (
              <span className="relative shrink-0">
                <Avatar
                  src={peer?.avatar_url || fallbackAvatar(peer?.id ?? conversationId)}
                  name={title}
                  seed={conversationId}
                  size={72}
                />
                {peer && (
                  <StatusDot
                    status={toPresenceStatus(peer.status)}
                    size={16}
                    className="absolute bottom-1 right-1"
                  />
                )}
              </span>
            )}
            <p className="text-sm font-medium">
              {isAi ? "Ask hi AI anything" : `Say hi to ${title} 👋`}
            </p>
            <p className="text-xs text-muted">
              {isAi
                ? "Drafts, plans, answers — right inside your chat."
                : "This is the beginning of your conversation."}
            </p>
          </div>
        ) : (
          visibleMessages.map((m, i) => {
            const prev = visibleMessages[i - 1];
            const showDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
            return (
              <Fragment key={m.id}>
                {showDay && (
                  <div className="my-3 text-center text-[11px] text-muted">{dayLabel(m.created_at)}</div>
                )}
                <Bubble m={m} mine={m.sender_id === user?.id} onLongPress={openMessageActions} />
              </Fragment>
            );
          })
        )}

        {peerTyping && !isAi && (
          <div className="mb-1.5 flex justify-start">
            <div className="flex items-center gap-1 rounded-[20px] rounded-bl-[6px] border border-line bg-surface px-3.5 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-bounce rounded-full bg-muted"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {aiThinking && (
          <div className="mb-1.5 flex items-end gap-2">
            <Logo size={24} className="mb-1 shrink-0" />
            <div className="flex items-center gap-1 rounded-[20px] rounded-bl-[6px] border border-line bg-surface px-3.5 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-pulse rounded-full bg-accent"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="safe-bottom border-t border-line/60 px-3 py-3">
        {notice && (
          <p className="mb-2 flex items-start gap-2 rounded-2xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
            <span className="flex-1">{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="text-amber-700/70 dark:text-amber-300/70">
              ×
            </button>
          </p>
        )}
        {uploading && (
          <p className="mb-2 flex items-center gap-2 text-[11.5px] text-muted">
            <Spinner tone="dark" className="size-3.5" />
            Sending your media…
          </p>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || recorder.recording}
            aria-label="Send photos or videos"
            title="Photos & videos"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted transition hover:text-ink disabled:opacity-50"
          >
            {uploading ? <Spinner tone="dark" className="size-4" /> : <ImagePlus size={18} />}
          </button>
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            disabled={uploading || recorder.recording}
            aria-label="Open camera"
            title="Camera"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-accent/30 bg-accent/[0.07] text-accent transition hover:bg-accent/10 disabled:opacity-50"
          >
            <Camera size={18} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={onPickMedia}
          />

          {recorder.recording ? (
            <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[24px] border border-red-200 bg-red-50/70 px-4 py-2.5 dark:border-red-400/30 dark:bg-red-500/10">
              <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
              <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-red-600 dark:text-red-400">
                {formatClock(recorder.seconds)}
              </span>
              <span className="truncate text-[11.5px] text-muted">Recording…</span>
              <button
                type="button"
                onClick={cancelVoice}
                aria-label="Cancel recording"
                className="ml-auto grid size-7 shrink-0 place-items-center rounded-full text-muted transition hover:bg-ink/[0.06] active:scale-90"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className="flex flex-1 items-center gap-2 rounded-[24px] border border-line bg-surface px-4 py-2.5">
              <input
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={isAi ? "Ask hi AI anything…" : "Message"}
                aria-label="Message"
                className="w-full bg-transparent text-[15px] outline-none"
              />
              {isAi && <Sparkles size={15} className="shrink-0 text-accent" />}
            </div>
          )}

          {recorder.recording ? (
            <button
              type="button"
              onClick={() => void sendVoice()}
              disabled={uploading}
              aria-label="Send voice note"
              title="Send voice note"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-white transition active:scale-95 disabled:opacity-40"
            >
              <Send size={17} />
            </button>
          ) : draft.trim() ? (
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending}
              aria-label="Send"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-white transition active:scale-95 disabled:opacity-40"
            >
              <Send size={17} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void recorder.start()}
              disabled={uploading || sending}
              aria-label="Record a voice note"
              title="Voice note"
              className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted transition hover:text-ink disabled:opacity-40"
            >
              <Mic size={18} />
            </button>
          )}
        </div>
      </div>

      {/* header ⋮ → clear chat history */}
      <FloatingSheet
        open={headerMenuOpen}
        onClose={() => {
          if (clearing) return;
          setHeaderMenuOpen(false);
          setConfirmClear(false);
          setClearError(null);
        }}
        label="Chat options"
      >
        {() => (
          <div className="relative overflow-hidden rounded-[30px] border border-line bg-surface/90 p-3 shadow-[0_32px_90px_-30px_rgba(16,17,20,0.45)] backdrop-blur-2xl">
            <span className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-ink/10 to-transparent" />
            <span className="mx-auto mb-4 mt-1 block h-1.5 w-11 rounded-full bg-ink/15" />
            {!confirmClear ? (
              <>
                <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
                  Chat
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[15px] font-medium text-red-600 transition hover:bg-red-500/[0.06] active:bg-red-500/10 dark:text-red-400"
                >
                  <Trash2 size={18} />
                  Clear chat history
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    setConfirmClear(false);
                  }}
                  className="mt-1 flex w-full items-center justify-center rounded-2xl px-3 py-3 text-[14px] font-medium text-muted transition hover:bg-ink/[0.04] active:bg-ink/[0.07]"
                >
                  Cancel
                </button>
              </>
            ) : (
              <div className="px-2 pb-1 pt-1">
                <p className="text-[16px] font-semibold">Clear chat history?</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                  {isAi
                    ? "Your AI conversation will be cleared from this account."
                    : "Messages in this chat will be removed for your account only. Other members keep their copy."}
                </p>
                {clearError && (
                  <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-snug text-red-600 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-400">
                    {clearError}
                  </p>
                )}
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    disabled={clearing}
                    onClick={() => {
                      setConfirmClear(false);
                      setClearError(null);
                    }}
                    className="h-12 flex-1 rounded-pill border border-line bg-surface text-[14px] font-medium text-ink/85 transition active:scale-[0.98] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={clearing}
                    onClick={() => void clearChat()}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-pill bg-red-600 text-[14px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
                  >
                    {clearing ? <Spinner /> : <Trash2 size={16} />} Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </FloatingSheet>

      {/* long-press a bubble → delete for everyone / for me */}
      <FloatingSheet open={actionOpen} onClose={closeMessageActions} label="Message options">
        {() => (
          <div className="relative overflow-hidden rounded-[30px] border border-line bg-surface/90 p-3 shadow-[0_32px_90px_-30px_rgba(16,17,20,0.45)] backdrop-blur-2xl">
            <span className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-ink/10 to-transparent" />
            <span className="mx-auto mb-4 mt-1 block h-1.5 w-11 rounded-full bg-ink/15" />
            <div className="px-3 pb-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Message</p>
              <p className="mt-1 truncate text-[13px] text-ink/70">{actionPreview}</p>
            </div>
            {!confirmDelete ? (
              <div className="space-y-0.5">
                {actionIsMine && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setConfirmDelete("everyone");
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[15px] font-medium text-red-600 transition hover:bg-red-500/[0.06] active:bg-red-500/10 dark:text-red-400"
                  >
                    <Users size={18} />
                    Delete for everyone
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setConfirmDelete("me");
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[15px] font-medium text-red-600 transition hover:bg-red-500/[0.06] active:bg-red-500/10 dark:text-red-400"
                >
                  <UserRound size={18} />
                  Delete for me
                </button>
                <button
                  type="button"
                  onClick={closeMessageActions}
                  className="mt-1 flex w-full items-center justify-center rounded-2xl px-3 py-3 text-[14px] font-medium text-muted transition hover:bg-ink/[0.04] active:bg-ink/[0.07]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="px-2 pb-1 pt-1">
                <p className="text-[16px] font-semibold">
                  {confirmDelete === "everyone" ? "Delete for everyone?" : "Delete for me?"}
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                  {confirmDelete === "everyone"
                    ? "The message will disappear from everyone’s chat right away."
                    : "The message will be hidden only for your account."}
                </p>
                {actionError && (
                  <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-snug text-red-600 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-400">
                    {actionError}
                  </p>
                )}
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    disabled={deletingMessage}
                    onClick={() => {
                      setConfirmDelete(null);
                      setActionError(null);
                    }}
                    className="h-12 flex-1 rounded-pill border border-line bg-surface text-[14px] font-medium text-ink/85 transition active:scale-[0.98] disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={deletingMessage}
                    onClick={() => {
                      if (!actionMessage) return;
                      if (confirmDelete === "everyone") void deleteForEveryone(actionMessage);
                      else if (confirmDelete === "me") void deleteForMe(actionMessage);
                    }}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-pill bg-red-600 text-[14px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
                  >
                    {deletingMessage ? <Spinner /> : <Trash2 size={16} />} Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </FloatingSheet>

      {peer && (
        <CallOverlay
          open={activeCall !== null}
          mode={activeCall?.mode ?? "voice"}
          name={activeCall?.target.name ?? title}
          avatarUrl={activeCall?.target.avatarUrl ?? (peer.avatar_url || fallbackAvatar(peer.id))}
          seed={activeCall?.target.seed ?? peer.id}
          onClose={endCall}
        />
      )}

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(capture) => void onCameraCapture(capture)}
        onUpload={() => {
          setCameraOpen(false);
          fileRef.current?.click();
        }}
      />
    </PhoneFrame>
  );
}

function Bubble({
  m,
  mine,
  onLongPress,
}: {
  m: MessageRow;
  mine: boolean;
  onLongPress: (m: MessageRow) => void;
}) {
  const longPress = useLongPress(() => onLongPress(m));
  if (m.deleted_at) return null;
  return (
    <div
      className={cn(
        "mb-1.5 flex items-end gap-2 select-none [-webkit-touch-callout:none]",
        mine ? "justify-end" : "justify-start"
      )}
    >
      {!mine && m.is_ai && <Logo size={24} className="mb-1 shrink-0" />}
      <div
        {...longPress}
        onContextMenu={(e) => {
          e.preventDefault();
          onLongPress(m);
        }}
        className={cn(
          "max-w-[76%] rounded-[20px] px-3.5 py-2.5 text-[15px] leading-snug",
          mine
            ? "rounded-br-[6px] bg-accent text-white"
            : "rounded-bl-[6px] border border-line bg-surface text-ink/95"
        )}
      >
        {m.media_url && (
          <SignedMedia
            path={m.media_url}
            type={m.media_type}
            tone={mine ? "onAccent" : "surface"}
            className={cn(
              "mb-1.5 rounded-2xl",
              m.media_type === "video"
                ? "w-full max-h-72 object-contain"
                : m.media_type === "audio"
                  ? "" // voice notes carry their own compact width
                  : "w-full max-h-72 object-cover"
            )}
          />
        )}
        {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
        <p className={cn("mt-1 text-right text-[10px]", mine ? "text-white/70" : "text-muted")}>
          {clockTime(m.created_at)}
        </p>
      </div>
    </div>
  );
}
