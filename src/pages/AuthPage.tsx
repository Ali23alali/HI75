import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { Logo } from "@/components/ui/Logo";
import { Spinner } from "@/components/ui/Spinner";
import { isEmail } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

export default function AuthPage() {
  const navigate = useNavigate();
  const { session, loading, configured } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) navigate("/messages", { replace: true });
  }, [loading, session, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!configured) {
      setError("Supabase is not configured. Add your keys to .env and restart.");
      return;
    }
    if (!isEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (mode === "signup" && !/^[a-z0-9._]{3,20}$/i.test(username)) {
      setError("Username: 3–20 letters, numbers, dots or underscores.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        // Register through the database (register_account RPC): this project has
        // email confirmation on and a rate-limited mailer, so GoTrue's native
        // sign-up can neither return a session nor reliably create the account.
        // The RPC creates the confirmed account; we sign in with it below.
        const { error: registerError } = await supabase.rpc("register_account", {
          p_email: email,
          p_password: password,
          p_username: username.toLowerCase(),
          p_display_name: displayName.trim() || username,
        });
        if (registerError) {
          const message = registerError.message || "";
          if (message.includes("email_taken")) {
            setMode("signin");
            setNotice("That email already has an account — sign in below.");
            return;
          }
          if (message.includes("username_taken")) {
            setError("That username is taken — try another one.");
            return;
          }
          if (message.includes("signup_rate_limited")) {
            setError("Too many sign-ups right now — try again in a little while.");
            return;
          }
          if (message.includes("invalid_email")) {
            setError("Enter a valid email address.");
            return;
          }
          if (message.includes("weak_password")) {
            setError("Password must be at least 6 characters.");
            return;
          }
          throw registerError;
        }
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      navigate("/messages", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message.replace("Email not confirmed", "Please confirm your email first."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PhoneFrame>
      <div className="flex flex-1 flex-col px-7 pb-10 pt-16">
        <button
          type="button"
          onClick={() => navigate("/welcome")}
          className="mb-10 w-fit text-sm text-muted transition hover:text-ink"
        >
          ← Back
        </button>

        <div className="flex items-center gap-4">
          <Logo size={56} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-sm text-muted">
              {mode === "signin" ? "Sign in to keep the conversation going." : "A few details and you're in."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-9 space-y-3">
          {mode === "signup" && (
            <>
              <Field
                label="Username"
                value={username}
                onChange={(v) => setUsername(v.replace(/\s/g, ""))}
                placeholder="yourhandle"
                autoComplete="username"
              />
              <Field
                label="Display name"
                value={displayName}
                onChange={setDisplayName}
                placeholder="Your name"
                autoComplete="name"
              />
            </>
          )}
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />

          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-accent">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className={cn(
              "mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-pill bg-strong text-[15px] font-semibold text-strong-fg transition active:scale-[0.985] disabled:opacity-60"
            )}
          >
            {busy ? <Spinner /> : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-auto pt-8 text-center text-sm text-muted">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
            className="font-medium text-ink underline-offset-4 hover:underline"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </PhoneFrame>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-14 w-full rounded-2xl border border-line bg-surface px-4 text-[15px] text-ink outline-none transition focus:border-ink/20 focus:bg-surface-2"
      />
    </label>
  );
}
