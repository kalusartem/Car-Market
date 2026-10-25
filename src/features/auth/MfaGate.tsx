import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthUser } from "../../lib/auth";
import { LogoMark } from "../../components/Logo";

/** Blocks the app until a signed-in user who enabled an authenticator app enters a code.
 *  Supabase reports aal1 -> aal2 as "next level" when a verified TOTP factor exists. */
export function MfaGate({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const { data: user } = useAuthUser();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: needsChallenge } = useQuery({
    queryKey: ["mfa", "needs-challenge", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) return false;
      return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
    },
  });

  if (!user || !needsChallenge) return <>{children}</>;

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) throw listErr;
      const factor = factors.totp[0];
      if (!factor) throw new Error("No authenticator app is set up on this account.");
      const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: code.trim(),
      });
      if (verifyErr) throw verifyErr;
      setCode("");
      await qc.invalidateQueries({ queryKey: ["mfa"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn’t work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    await qc.invalidateQueries();
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-10">
      <form onSubmit={verify} className="card w-full p-6 shadow-pop sm:p-8">
        <div className="flex flex-col items-center text-center">
          <LogoMark size={44} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Two-step verification</h1>
          <p className="mt-1 text-sm text-muted">
            Enter the 6-digit code from your authenticator app to finish signing in.
          </p>
        </div>
        <label className="mt-6 block">
          <span className="mb-1 block text-sm text-muted">Authentication code</span>
          <input
            className="input h-12 text-center text-xl tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
        <button type="submit" className="btn-primary mt-5 h-11 w-full" disabled={busy || code.length !== 6}>
          {busy ? "Verifying…" : "Verify"}
        </button>
        <button type="button" className="btn-ghost mt-2 w-full" onClick={signOut}>
          Sign out
        </button>
      </form>
    </div>
  );
}
