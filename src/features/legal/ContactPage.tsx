import { useState, type FormEvent } from "react";
import { usePageMeta } from "../../hooks/usePageMeta";

export function ContactPage() {
  usePageMeta({ title: "Contact us" });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(f)),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not send your message.");
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your message.");
      setState("idle");
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Contact us</h1>
      <p className="mt-2 text-muted">
        Questions, privacy or account-deletion requests, takedowns, or feedback. Include your email if you would
        like a reply.
      </p>
      {state === "sent" ? (
        <div role="status" className="mt-6 rounded-xl border border-line bg-surface px-4 py-3 text-fg">
          Thanks — your message was sent.
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="c-name" className="text-sm text-muted">Name (optional)</label>
            <input id="c-name" name="name" maxLength={100} autoComplete="name" className="input mt-1" />
          </div>
          <div>
            <label htmlFor="c-email" className="text-sm text-muted">Email (optional)</label>
            <input id="c-email" name="email" type="email" maxLength={200} autoComplete="email" className="input mt-1" />
          </div>
          {/* Honeypot: hidden from people, filled by bots. */}
          <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
          <div>
            <label htmlFor="c-msg" className="text-sm text-muted">Message</label>
            <textarea id="c-msg" name="message" required minLength={10} maxLength={4000} className="input mt-1 min-h-[140px]" />
          </div>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <button className="btn-primary" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Send message"}
          </button>
        </form>
      )}
    </main>
  );
}
