import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheckIcon } from "../../components/icons";
import { supabase } from "../../lib/supabase";

type Enrollment = { factorId: string; qr: string; secret: string };

/** Optional authenticator-app (TOTP) two-step verification via Supabase Auth MFA. */
export function SecuritySettings() {
  const qc = useQueryClient();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const factors = useQuery({
    queryKey: ["mfa", "factors"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data;
    },
  });
  const verified = factors.data?.totp ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["mfa"] });

  const start = useMutation({
    mutationFn: async () => {
      setError(null);
      // Clean up abandoned, never-verified enrollments so a new one can start.
      for (const f of factors.data?.all ?? []) {
        if (f.factor_type === "totp" && f.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator ${new Date().toLocaleDateString("en-US")}`,
      });
      if (error) throw error;
      setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn’t start setup."),
  });

  const confirm = useMutation({
    mutationFn: async () => {
      setError(null);
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment!.factorId,
        code: code.trim(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setEnrollment(null);
      setCode("");
      await refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "That code didn’t work."),
  });

  const remove = useMutation({
    mutationFn: async (factorId: string) => {
      setError(null);
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn’t remove it."),
  });

  const cancel = async () => {
    if (enrollment) await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
    setEnrollment(null);
    setCode("");
    setError(null);
  };

  return (
    <section className="card mt-6 p-6" aria-labelledby="security-title">
      <div className="flex items-start gap-3">
        <ShieldCheckIcon className="mt-0.5 shrink-0 text-link" />
        <div className="min-w-0 flex-1">
          <h2 id="security-title" className="text-lg font-semibold">Two-step verification</h2>
          <p className="mt-1 text-sm text-muted">
            Add an authenticator app (Google Authenticator, 1Password, Authy…) so a stolen sign-in isn’t enough
            to get into your account. Optional.
          </p>

          {factors.isLoading ? (
            <p className="mt-4 text-sm text-subtle">Loading…</p>
          ) : enrollment ? (
            <div className="mt-4 space-y-4">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
                <li>Scan this QR code with your authenticator app.</li>
                <li>Enter the 6-digit code it shows.</li>
              </ol>
              <img src={enrollment.qr} alt="QR code for your authenticator app" className="h-44 w-44 rounded-lg border border-line bg-white p-2" />
              <p className="text-xs text-subtle">
                Can’t scan? Enter this key manually: <code className="select-all rounded bg-surface-3 px-1.5 py-0.5 text-fg">{enrollment.secret}</code>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="input w-40 text-center tracking-[0.3em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  aria-label="6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
                <button type="button" className="btn-primary" disabled={code.length !== 6 || confirm.isPending} onClick={() => confirm.mutate()}>
                  {confirm.isPending ? "Verifying…" : "Turn on"}
                </button>
                <button type="button" className="btn-ghost" onClick={cancel}>Cancel</button>
              </div>
            </div>
          ) : verified.length > 0 ? (
            <div className="mt-4">
              <p className="inline-flex items-center gap-2 rounded-full bg-success-bg px-3 py-1 text-sm font-medium text-success">
                On — {verified.length} authenticator{verified.length === 1 ? "" : "s"}
              </p>
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
                {verified.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="truncate">{f.friendly_name ?? "Authenticator app"}</span>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm("Remove this authenticator? Your account will only be protected by your sign-in provider.")) remove.mutate(f.id);
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <button type="button" className="btn-primary mt-4" disabled={start.isPending} onClick={() => start.mutate()}>
              {start.isPending ? "Starting…" : "Set up authenticator app"}
            </button>
          )}

          {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
