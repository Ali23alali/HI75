// ============================================================================
// Supabase Edge Function: ai-reply
//
// Reads the recent history of an AI conversation, asks an LLM for one reply
// and stores it through the `post_ai_reply` RPC (is_ai = true).
//
// The function runs with the *caller's* JWT — no service-role key is used
// anywhere in this project. The LLM key lives only in Supabase secrets.
//
// Required secret:
//   OPENAI_API_KEY   e.g. sk-...            (never shipped to clients)
// Optional secrets:
//   AI_MODEL         default "gpt-4o-mini"
//   AI_BASE_URL      default "https://api.openai.com/v1"
//                    (any OpenAI-compatible endpoint works, e.g. OpenRouter)
//
// SUPABASE_URL / SUPABASE_ANON_KEY are injected automatically by the platform.
//
// Deploy:
//   supabase functions deploy ai-reply --project-ref gltugkygbapppccsurpa
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are "hi AI", the friendly assistant inside a chat app called "hi".
Keep answers short and warm — usually 1-4 sentences, plain text, no markdown headings.
Be helpful for drafting replies, planning, brainstorming and casual chat.`;

type DbMessage = {
  body: string | null;
  is_ai: boolean;
  created_at: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "missing bearer token" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) return json({ error: "missing platform env" }, 500);

    // A client scoped to the caller — RLS applies exactly as it does in the app.
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: auth } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: "invalid session" }, 401);

    const payload = await req.json().catch(() => ({}));
    const conversationId: string | undefined = payload?.conversation_id;
    if (!conversationId) return json({ error: "conversation_id is required" }, 400);

    // RLS means this row is only visible if the caller is a member.
    const { data: convo, error: convoError } = await supabase
      .from("conversations")
      .select("id, type")
      .eq("id", conversationId)
      .maybeSingle();
    if (convoError) return json({ error: convoError.message }, 400);
    if (!convo) return json({ error: "conversation not found" }, 404);
    if (convo.type !== "ai") return json({ error: "not an AI conversation" }, 403);

    const { data: history, error: historyError } = await supabase
      .from("messages")
      .select("body, is_ai, created_at")
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    if (historyError) return json({ error: historyError.message }, 400);

    const messages = ((history ?? []) as DbMessage[])
      .reverse()
      .filter((m) => m.body && m.body.trim().length > 0)
      .map((m) => ({
        role: m.is_ai ? ("assistant" as const) : ("user" as const),
        content: (m.body as string).trim(),
      }));

    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      return json({ ok: true, skipped: "nothing to answer" });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      // No model key configured yet: keep the chat usable with a demo reply
      // (the same behaviour the app falls back to when the function is absent).
      const reply = mockReply(messages[messages.length - 1]?.content ?? "");
      const { error: mockError } = await supabase.rpc("post_ai_reply", {
        cid: conversationId,
        body: reply,
      });
      if (mockError) return json({ error: mockError.message }, 400);
      return json({
        ok: true,
        mock: true,
        reply,
        hint: "Set the OPENAI_API_KEY secret for real answers.",
      });
    }

    const baseUrl = (Deno.env.get("AI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = Deno.env.get("AI_MODEL") ?? "gpt-4o-mini";

    const llmResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 512,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    if (!llmResponse.ok) {
      const detail = (await llmResponse.text()).slice(0, 300);
      return json({ error: `LLM request failed (${llmResponse.status})`, detail }, 502);
    }

    const completion = await llmResponse.json();
    const reply: string = completion?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!reply) return json({ error: "the model returned an empty reply" }, 502);

    const { data: messageId, error: insertError } = await supabase.rpc("post_ai_reply", {
      cid: conversationId,
      body: reply,
    });
    if (insertError) return json({ error: insertError.message }, 400);

    return json({ ok: true, message_id: messageId, reply });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Offline demo reply used when OPENAI_API_KEY is not configured. */
function mockReply(input: string): string {
  const text = input.trim();
  const lower = text.toLowerCase();
  if (!text || /^(hi|hey|hello|yo|howdy|sup|hola)\b/i.test(text)) {
    return "Hey! 👋 I'm in demo mode right now, but the chat is working end-to-end.";
  }
  if (lower.includes("how are you")) {
    return "Running smoothly in demo mode — thanks for asking! 🙂";
  }
  if (/\b(thanks|thank you|thx)\b/.test(lower)) return "Anytime! (demo reply)";
  if (/^\[(photo|video)\]$/i.test(text)) {
    return "Nice one! 📷 (demo reply — I'll be able to look at photos once the real AI is connected.)";
  }
  if (/^\[voice\]$/i.test(text)) {
    return "Got your voice note! 🎙️ (demo reply — the real AI can't listen to audio yet.)";
  }
  if (lower.includes("help")) {
    return "I'm in demo mode, so I can't do real work yet. Set the OPENAI_API_KEY secret to unlock me.";
  }
  if (text.endsWith("?")) {
    return "Great question — the real model isn't connected yet, so here's a demo reply while you keep testing the app.";
  }
  const options = [
    "Got it! (demo reply — the real AI is offline right now.)",
    "I'm here, just in demo mode. Your message came through loud and clear.",
    "Nice — I can see the chat working end-to-end. (demo reply)",
    "Noted! Set the OPENAI_API_KEY secret for real answers. (demo reply)",
  ];
  return options[text.length % options.length];
}
