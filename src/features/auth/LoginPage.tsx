import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { usePageMeta } from "../../hooks/usePageMeta";
import {
  EMAIL_LOGIN_ENABLED,
  signInWithEmail,
  signInWithProvider,
  useAuthUser,
  type OAuthProvider,
} from "../../lib/auth";
import { MailIcon } from "../../components/icons";
import { LogoMark } from "../../components/Logo";
import { GitHubIcon, GoogleIcon } from "./ProviderIcons";

function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const { data: user, isLoading } = useAuthUser();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  usePageMeta({ title: "Sign in", noindex: true });

  if (!isLoading && user) return <Navigate to={next} replace />;

  const oauth = async (p: OAuthProvider) => {
    setError(null);
    const { error } = await signInWithProvider(p, next);
    if (error) setError(error.message);
  };

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus("sending");
    const { error } = await signInWithEmail(email.trim(), next);
    if (error) {
      setError(error.message);
      setStatus("idle");
    } else {
      setStatus("sent");
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-10">
      <div className="card w-full p-6 shadow-pop sm:p-8">
        <div className="flex flex-col items-center text-center">
          <LogoMark size={44} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Sign in to Car Market</h1>
          <p className="mt-1 text-sm text-muted">
            Save cars, message sellers and list your own. No password to remember.
          </p>
        </div>

        <div className="mt-6 grid gap-3">
          <button type="button" className="btn-secondary h-11" onClick={() => oauth("google")}>
            <GoogleIcon /> Continue with Google
          </button>
          <button type="button" className="btn-secondary h-11" onClick={() => oauth("github")}>
            <GitHubIcon /> Continue with GitHub
          </button>
        </div>

        {EMAIL_LOGIN_ENABLED ? (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-subtle">
              <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
            </div>
            {status === "sent" ? (
              <div role="status" className="rounded-xl border border-success/30 bg-success-bg p-4 text-sm text-success">
                Check <strong>{email}</strong> — we sent you a sign-in link.
              </div>
            ) : (
              <form onSubmit={sendLink} className="grid gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm text-muted">Email address</span>
                  <input className="input h-11" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </label>
                <button type="submit" className="btn-primary h-11" disabled={status === "sending"}>
                  <MailIcon size={18} />
                  {status === "sending" ? "Sending…" : "Email me a sign-in link"}
                </button>
              </form>
            )}
          </>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 text-sm text-danger">{error}</p>
        ) : null}

        <p className="mt-6 text-center text-xs text-subtle">
          By continuing you agree to our <Link to="/terms" className="underline">Terms</Link> and{" "}
          <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
