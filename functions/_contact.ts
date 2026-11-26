// POST /api/contact — the Contact page posts {name, email, message}; we email it to the site operator
// through the same SMTP settings as the listing-review notice (functions/_notify.ts). The operator's address
// is only ever read server-side (NOTIFY_TO) and never sent to the browser. Without SMTP it is only logged.
// Each IP gets CONTACT_LIMIT.max send attempts per hour (best effort, see functions/_rateLimit.ts).

import { notifyTo, type Env } from "./_lib";
import { sendMail, smtpConfigured, type Connect } from "./_mail";
import { hitRateLimit, type Limit } from "./_rateLimit";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CONTACT_LIMIT: Limit = { name: "contact", max: 5, windowMs: 60 * 60 * 1000 };

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

export async function sendContact(request: Request, env: Env, connect: Connect): Promise<Response> {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  // Hidden "website" field: real people leave it empty, bots fill it. Pretend success.
  if (str(b.website, 200)) return json({ ok: true });

  const name = str(b.name, 100);
  const email = str(b.email, 200);
  const message = str(b.message, 4000);
  if (message.length < 10) return json({ error: "Please write a few more words." }, 400);
  if (email && !EMAIL.test(email)) return json({ error: "That email address looks wrong." }, 400);

  if (!smtpConfigured(env)) {
    console.warn("[contact] message received, logged only — SMTP not configured");
    return json({ error: "Contact is not available right now." }, 503);
  }
  // Counted before sending, so a failing mail server can't be hammered either.
  const limit = await hitRateLimit(request, CONTACT_LIMIT);
  if (!limit.ok) {
    return json({ error: "Too many messages from this address. Please try again later." }, 429, {
      "retry-after": String(limit.retryAfter),
    });
  }
  const to = notifyTo(env, "contact");
  if (!to) return json({ error: "The contact form is not available right now." }, 503);
  try {
    await sendMail(env, connect, {
      to,
      subject: `Car Market contact: ${name || "anonymous"}`,
      text: [`From: ${name || "(no name)"} <${email || "no email given"}>`, "", message].join("\n"),
    });
    return json({ ok: true });
  } catch (e) {
    console.error("[contact] email failed:", e);
    return json({ error: "Could not send your message. Please try again later." }, 502);
  }
}
