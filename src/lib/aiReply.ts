import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Turns a `supabase.functions.invoke` failure into a short, human-readable
 * cause so the chat notice can tell the user *why* hi AI is offline
 * (not deployed, missing secret, LLM 401, network, …).
 */
export async function describeAiFailure(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;
    if (status === 404) return 'the "ai-reply" function is not deployed on this project';
    let detail = "";
    try {
      const payload = (await error.context.clone().json()) as {
        error?: string;
        message?: string;
        detail?: string;
      };
      detail = payload.error ?? payload.message ?? "";
      if (payload.detail) detail += ` — ${payload.detail}`;
    } catch {
      // response body was empty or not JSON
    }
    return `HTTP ${status}${detail ? `: ${detail.slice(0, 180)}` : ""}`;
  }
  if (error instanceof FunctionsFetchError) return "network error reaching the function";
  if (error instanceof FunctionsRelayError) return `relay error: ${error.message}`;
  if (error instanceof Error) return error.message;
  return "unknown error";
}

/**
 * Local stand-in for the LLM: a short, clearly-labelled demo reply so the
 * chat flow keeps working while the real AI is unavailable.
 */
export function mockAiReply(input: string): string {
  const text = input.trim();
  const lower = text.toLowerCase();

  if (!text || /^(hi|hey|hello|yo|howdy|sup|hola)\b/i.test(text)) {
    return "Hey! 👋 I'm in demo mode right now, but the chat is working end-to-end.";
  }
  if (lower.includes("how are you")) {
    return "Running smoothly in demo mode — thanks for asking! 🙂";
  }
  if (/\b(thanks|thank you|thx)\b/.test(lower)) {
    return "Anytime! (demo reply)";
  }
  if (/^\[(photo|video)\]$/i.test(text)) {
    return "Nice one! 📷 (demo reply — I'll be able to look at photos once the real AI is connected.)";
  }
  if (/^\[voice\]$/i.test(text)) {
    return "Got your voice note! 🎙️ (demo reply — the real AI can't listen to audio yet.)";
  }
  if (lower.includes("help")) {
    return "I'm in demo mode, so I can't do real work yet. Deploy the ai-reply function and set the OPENAI_API_KEY secret to unlock me.";
  }
  if (text.endsWith("?")) {
    return "Great question — the real model isn't connected yet, so here's a demo reply while you keep testing the app.";
  }
  const options = [
    "Got it! (demo reply — the real AI is offline right now.)",
    "I'm here, just in demo mode. Your message came through loud and clear.",
    "Nice — I can see the chat working end-to-end. (demo reply)",
    "Noted! Connect the ai-reply function for real answers. (demo reply)",
  ];
  return options[text.length % options.length];
}

/**
 * Stores a mock assistant message through the `post_ai_reply` RPC (the same
 * SECURITY DEFINER helper the Edge Function uses, granted to authenticated).
 * Returns an error string when it could not be saved.
 */
export async function postAiReply(
  conversationId: string,
  body: string
): Promise<string | null> {
  const { error } = await supabase.rpc("post_ai_reply", {
    cid: conversationId,
    body,
  });
  return error ? error.message : null;
}
